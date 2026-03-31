import {
  generateFollowUpDraft as generateDeterministicFollowUpDraft,
  generatePreEventFollowUpDraft,
  normalizeEncounterNote,
  nowIso,
  type Encounter,
  type Event,
  type GeneratedDraft,
  type GenerationFallbackReason,
  type GenerationMetadata,
  type Person,
  type Session,
  type Target
} from '@copilot/core';
import {
  generateFollowUpDraftWithOpenAI,
  structureEncounterWithOpenAI
} from '@copilot/connectors';

const OPENAI_MODEL = 'gpt-5.2';
const NOTE_STRUCTURING_PROMPT_ID = 'note-structuring.v1';
const FOLLOW_UP_DRAFT_PROMPT_ID = 'follow-up-draft.v1';

export interface EncounterStructuringResult {
  summary: string;
  nextSteps: string[];
  metadata: GenerationMetadata;
}

export interface GeneratedDraftResult extends GeneratedDraft {
  metadata: GenerationMetadata;
}

export interface EncounterStructuringContext {
  event: Event;
  person: Person;
  target?: Target;
  companyName?: string;
  noteText: string;
  tags: string[];
  outcome?: 'MET' | 'MISSED';
  session?: Session;
  speaker?: Person;
}

export interface DraftGenerationContext {
  event: Event;
  person: Person;
  target?: Target;
  companyName?: string;
  encounter?: Encounter;
  session?: Session;
  speaker?: Person;
  senderName?: string;
}

export interface GenerationService {
  structureEncounter(context: EncounterStructuringContext): Promise<EncounterStructuringResult>;
  generateDraft(context: DraftGenerationContext): Promise<GeneratedDraftResult>;
}

class StructuredOutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StructuredOutputValidationError';
  }
}

function presentString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function generationErrorReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length <= 300 ? message : `${message.slice(0, 297)}...`;
}

function baseMetadata(params: {
  operation: GenerationMetadata['operation'];
  promptId: string;
}): Pick<GenerationMetadata, 'operation' | 'generatedAt' | 'promptId'> {
  return {
    operation: params.operation,
    generatedAt: nowIso(),
    promptId: params.promptId
  };
}

function buildFallbackMetadata(params: {
  operation: GenerationMetadata['operation'];
  promptId: string;
  fallbackReason: GenerationFallbackReason;
  errorReason?: string;
}): GenerationMetadata {
  return {
    mode: 'fallback',
    provider: 'DETERMINISTIC',
    ...baseMetadata(params),
    fallbackReason: params.fallbackReason,
    errorReason: params.errorReason
  };
}

function buildLiveMetadata(params: {
  operation: GenerationMetadata['operation'];
  promptId: string;
  model: string;
  responseId: string;
}): GenerationMetadata {
  return {
    mode: 'live',
    provider: 'OPENAI',
    ...baseMetadata(params),
    model: params.model,
    responseId: params.responseId
  };
}

function parseStructuredOutput(outputText: string): unknown {
  try {
    return JSON.parse(outputText);
  } catch (error) {
    throw new StructuredOutputValidationError(generationErrorReason(error));
  }
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new StructuredOutputValidationError(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new StructuredOutputValidationError(`${label} must be a string.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new StructuredOutputValidationError(`${label} must not be empty.`);
  }

  return trimmed;
}

function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new StructuredOutputValidationError(`${label} must be an array of strings.`);
  }

  const cleaned = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (cleaned.length === 0) {
    throw new StructuredOutputValidationError(`${label} must include at least one item.`);
  }

  return [...new Set(cleaned)];
}

function validateEncounterOutput(value: unknown): Pick<EncounterStructuringResult, 'summary' | 'nextSteps'> {
  const payload = requireObject(value, 'Encounter output');
  return {
    summary: requireString(payload.summary, 'Encounter summary'),
    nextSteps: requireStringArray(payload.nextSteps, 'Encounter nextSteps')
  };
}

function validateDraftOutput(value: unknown): GeneratedDraft {
  const payload = requireObject(value, 'Draft output');
  return {
    subject: requireString(payload.subject, 'Draft subject'),
    body: requireString(payload.body, 'Draft body'),
    summary: requireString(payload.summary, 'Draft summary'),
    nextSteps: requireStringArray(payload.nextSteps, 'Draft nextSteps')
  };
}

function readOpenAIApiKey(): string | undefined {
  return presentString(process.env.OPENAI_API_KEY);
}

class DefaultGenerationService implements GenerationService {
  async structureEncounter(
    context: EncounterStructuringContext
  ): Promise<EncounterStructuringResult> {
    const fallbackOutput = normalizeEncounterNote(context.noteText);
    const apiKey = readOpenAIApiKey();

    if (!apiKey) {
      return {
        ...fallbackOutput,
        metadata: buildFallbackMetadata({
          operation: 'NOTE_STRUCTURING',
          promptId: NOTE_STRUCTURING_PROMPT_ID,
          fallbackReason: 'OPENAI_API_KEY_MISSING'
        })
      };
    }

    let liveResponse: Awaited<ReturnType<typeof structureEncounterWithOpenAI>>;
    try {
      liveResponse = await structureEncounterWithOpenAI({
        apiKey,
        model: OPENAI_MODEL,
        context: {
          event: context.event,
          person: context.person,
          target: context.target,
          companyName: context.companyName,
          noteText: context.noteText,
          tags: context.tags,
          outcome: context.outcome,
          sessionTitle: context.session?.title,
          speakerName: context.speaker?.fullName
        }
      });
    } catch (error) {
      return {
        ...fallbackOutput,
        metadata: buildFallbackMetadata({
          operation: 'NOTE_STRUCTURING',
          promptId: NOTE_STRUCTURING_PROMPT_ID,
          fallbackReason: 'OPENAI_REQUEST_FAILED',
          errorReason: generationErrorReason(error)
        })
      };
    }

    try {
      const parsedOutput = validateEncounterOutput(parseStructuredOutput(liveResponse.outputText));
      return {
        ...parsedOutput,
        metadata: buildLiveMetadata({
          operation: 'NOTE_STRUCTURING',
          promptId: NOTE_STRUCTURING_PROMPT_ID,
          model: liveResponse.model,
          responseId: liveResponse.responseId
        })
      };
    } catch (error) {
      return {
        ...fallbackOutput,
        metadata: buildFallbackMetadata({
          operation: 'NOTE_STRUCTURING',
          promptId: NOTE_STRUCTURING_PROMPT_ID,
          fallbackReason: 'OPENAI_OUTPUT_INVALID',
          errorReason: generationErrorReason(error)
        })
      };
    }
  }

  async generateDraft(context: DraftGenerationContext): Promise<GeneratedDraftResult> {
    if (!context.encounter) {
      return {
        ...generatePreEventFollowUpDraft({
          event: context.event,
          person: context.person,
          senderName: context.senderName
        }),
        metadata: buildFallbackMetadata({
          operation: 'FOLLOW_UP_DRAFT',
          promptId: FOLLOW_UP_DRAFT_PROMPT_ID,
          fallbackReason: 'NO_ENCOUNTER_CONTEXT'
        })
      };
    }

    const fallbackOutput = generateDeterministicFollowUpDraft({
      event: context.event,
      person: context.person,
      encounter: context.encounter,
      senderName: context.senderName
    });
    const apiKey = readOpenAIApiKey();

    if (!apiKey) {
      return {
        ...fallbackOutput,
        metadata: buildFallbackMetadata({
          operation: 'FOLLOW_UP_DRAFT',
          promptId: FOLLOW_UP_DRAFT_PROMPT_ID,
          fallbackReason: 'OPENAI_API_KEY_MISSING'
        })
      };
    }

    let liveResponse: Awaited<ReturnType<typeof generateFollowUpDraftWithOpenAI>>;
    try {
      liveResponse = await generateFollowUpDraftWithOpenAI({
        apiKey,
        model: OPENAI_MODEL,
        context: {
          event: context.event,
          person: context.person,
          target: context.target,
          companyName: context.companyName,
          encounter: context.encounter,
          sessionTitle: context.session?.title,
          speakerName: context.speaker?.fullName,
          senderName: context.senderName
        }
      });
    } catch (error) {
      return {
        ...fallbackOutput,
        metadata: buildFallbackMetadata({
          operation: 'FOLLOW_UP_DRAFT',
          promptId: FOLLOW_UP_DRAFT_PROMPT_ID,
          fallbackReason: 'OPENAI_REQUEST_FAILED',
          errorReason: generationErrorReason(error)
        })
      };
    }

    try {
      const parsedOutput = validateDraftOutput(parseStructuredOutput(liveResponse.outputText));
      return {
        ...parsedOutput,
        metadata: buildLiveMetadata({
          operation: 'FOLLOW_UP_DRAFT',
          promptId: FOLLOW_UP_DRAFT_PROMPT_ID,
          model: liveResponse.model,
          responseId: liveResponse.responseId
        })
      };
    } catch (error) {
      return {
        ...fallbackOutput,
        metadata: buildFallbackMetadata({
          operation: 'FOLLOW_UP_DRAFT',
          promptId: FOLLOW_UP_DRAFT_PROMPT_ID,
          fallbackReason: 'OPENAI_OUTPUT_INVALID',
          errorReason: generationErrorReason(error)
        })
      };
    }
  }
}

export function createGenerationService(): GenerationService {
  return new DefaultGenerationService();
}
