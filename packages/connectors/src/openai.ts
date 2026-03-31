import type { Encounter, Event, Person, Target } from '@copilot/core';
import OpenAI from 'openai';

const DEFAULT_OPENAI_MODEL = 'gpt-5.2';

const encounterSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: {
      type: 'string',
      description: 'A grounded 1-2 sentence summary of the encounter note.'
    },
    nextSteps: {
      type: 'array',
      description: 'One to three concrete follow-up actions grounded in the note and context.',
      items: {
        type: 'string'
      }
    }
  },
  required: ['summary', 'nextSteps']
} as const;

const followUpDraftSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    subject: {
      type: 'string',
      description: 'A concise plain-text email subject line.'
    },
    body: {
      type: 'string',
      description: 'A plain-text follow-up email body with greeting and close.'
    },
    summary: {
      type: 'string',
      description: 'A short recap of why this follow-up exists.'
    },
    nextSteps: {
      type: 'array',
      description: 'One to three concrete follow-up actions grounded in the encounter.',
      items: {
        type: 'string'
      }
    }
  },
  required: ['subject', 'body', 'summary', 'nextSteps']
} as const;

export interface OpenAIResponseJsonResult {
  responseId: string;
  model: string;
  outputText: string;
}

export interface OpenAIEncounterStructuringInput {
  apiKey: string;
  model?: string;
  context: {
    event: Event;
    person: Person;
    target?: Target;
    companyName?: string;
    noteText: string;
    tags: string[];
    outcome?: 'MET' | 'MISSED';
    sessionTitle?: string;
    speakerName?: string;
  };
}

export interface OpenAIFollowUpDraftInput {
  apiKey: string;
  model?: string;
  context: {
    event: Event;
    person: Person;
    target?: Target;
    companyName?: string;
    encounter: Encounter;
    sessionTitle?: string;
    speakerName?: string;
    senderName?: string;
  };
}

function presentString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function renderContext(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function requestStructuredJson(params: {
  apiKey: string;
  model?: string;
  schemaName: string;
  schema: Record<string, unknown>;
  systemPrompt: string;
  userPrompt: string;
}): Promise<OpenAIResponseJsonResult> {
  const model = params.model ?? DEFAULT_OPENAI_MODEL;
  const client = new OpenAI({
    apiKey: params.apiKey
  });
  const response = await client.responses.create({
    model,
    input: [
      {
        role: 'system',
        content: params.systemPrompt
      },
      {
        role: 'user',
        content: params.userPrompt
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: params.schemaName,
        schema: params.schema,
        strict: true
      }
    }
  });

  if (response.status !== 'completed') {
    const errorMessage =
      typeof response.error?.message === 'string'
        ? response.error.message
        : typeof response.incomplete_details?.reason === 'string'
          ? `response incomplete: ${response.incomplete_details.reason}`
          : `response status was ${response.status}`;

    throw new Error(`OpenAI response did not complete: ${errorMessage}`);
  }

  const outputText = response.output_text?.trim();
  if (!outputText) {
    throw new Error('OpenAI returned an empty structured response.');
  }

  return {
    responseId: response.id,
    model: String(response.model ?? model),
    outputText
  };
}

export async function structureEncounterWithOpenAI(
  params: OpenAIEncounterStructuringInput
): Promise<OpenAIResponseJsonResult> {
  const context = {
    event: {
      name: params.context.event.name,
      venue: params.context.event.venue ?? null,
      city: params.context.event.city ?? null,
      startsAt: params.context.event.startsAt,
      endsAt: params.context.event.endsAt,
      timezone: params.context.event.timezone
    },
    person: {
      fullName: params.context.person.fullName,
      title: params.context.person.title ?? null,
      companyName: presentString(params.context.companyName) ?? null
    },
    target: params.context.target
      ? {
          priority: params.context.target.priority,
          status: params.context.target.status,
          why: params.context.target.why
        }
      : null,
    encounter: {
      noteText: params.context.noteText,
      tags: params.context.tags,
      outcome: params.context.outcome ?? null,
      sessionTitle: presentString(params.context.sessionTitle) ?? null,
      speakerName: presentString(params.context.speakerName) ?? null
    }
  };

  return requestStructuredJson({
    apiKey: params.apiKey,
    model: params.model,
    schemaName: 'normalized_encounter_summary',
    schema: encounterSchema,
    systemPrompt: [
      'You structure conference rep encounter notes into grounded JSON.',
      'Use only facts that are explicit in the provided context.',
      'Do not invent meetings, commitments, product claims, or pricing details.',
      'Keep summary to one or two sentences.',
      'Return one to three next steps grounded in explicit asks or obvious follow-up actions.',
      'Never rewrite or replace the human-authored note itself.',
      'Return JSON only.'
    ].join(' '),
    userPrompt: `Normalize this encounter context into the requested JSON structure:\n${renderContext(context)}`
  });
}

export async function generateFollowUpDraftWithOpenAI(
  params: OpenAIFollowUpDraftInput
): Promise<OpenAIResponseJsonResult> {
  const context = {
    event: {
      name: params.context.event.name,
      venue: params.context.event.venue ?? null,
      city: params.context.event.city ?? null,
      startsAt: params.context.event.startsAt,
      endsAt: params.context.event.endsAt,
      timezone: params.context.event.timezone
    },
    person: {
      fullName: params.context.person.fullName,
      title: params.context.person.title ?? null,
      companyName: presentString(params.context.companyName) ?? null
    },
    target: params.context.target
      ? {
          priority: params.context.target.priority,
          status: params.context.target.status,
          why: params.context.target.why
        }
      : null,
    encounter: {
      noteText: params.context.encounter.noteText,
      structuredSummary: params.context.encounter.structuredSummary,
      nextSteps: params.context.encounter.nextSteps,
      tags: params.context.encounter.tags,
      outcome: params.context.encounter.outcome ?? null,
      sessionTitle: presentString(params.context.sessionTitle) ?? null,
      speakerName: presentString(params.context.speakerName) ?? null
    },
    senderName: presentString(params.context.senderName) ?? 'Your Name'
  };

  return requestStructuredJson({
    apiKey: params.apiKey,
    model: params.model,
    schemaName: 'follow_up_draft_fields',
    schema: followUpDraftSchema,
    systemPrompt: [
      'You create plain-text follow-up email draft suggestions for a conference rep.',
      'Ground every part of the draft in the provided event, person, target, and encounter context.',
      'Do not invent commitments, timeline promises, product claims, or meetings that are not supported by the context.',
      'Keep the draft concise and suitable for a Gmail draft that has not been sent.',
      'Include a greeting and a close with the provided sender name.',
      'Return JSON only.'
    ].join(' '),
    userPrompt: `Create suggested follow-up draft fields from this context:\n${renderContext(context)}`
  });
}
