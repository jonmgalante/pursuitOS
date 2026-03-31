import { createGmailDraft, createHubSpotTask } from '@copilot/connectors';
import {
  rankSessions,
  type Company,
  type CapturePagePayload,
  type Encounter,
  type FollowUpDraft,
  type RankedSession,
  type TargetPriority,
  type TargetStatus,
  type Task
} from '@copilot/core';
import {
  type FirstSliceRepository,
  type IngestCaptureBatchResult,
  type WorkspaceListItem,
  type WorkspaceSummary
} from '../repositories/first-slice-repository';
import { createFileFirstSliceRepository } from '../repositories/file-first-slice-repository';
import { createPrismaFirstSliceRepository } from '../repositories/prisma-first-slice-repository';
import { createGenerationService, type GenerationService } from './generation-service';

export interface WorkspaceView {
  workspace: WorkspaceSummary;
  rankedSessions: RankedSession[];
}

export interface FirstSliceService {
  ensureDemoWorkspace(): Promise<string>;
  listWorkspaces(): Promise<WorkspaceListItem[]>;
  getWorkspaceView(workspaceId: string): Promise<WorkspaceView>;
  ingestCapture(workspaceId: string, capture: CapturePagePayload): Promise<IngestCaptureBatchResult>;
  markTarget(workspaceId: string, personId: string, priority: TargetPriority): Promise<void>;
  updateTargetStatus(workspaceId: string, personId: string, status: TargetStatus): Promise<void>;
  logEncounter(params: {
    workspaceId: string;
    personId: string;
    noteText: string;
    tags: string[];
    outcome?: 'MET' | 'MISSED';
    sessionId?: string;
    speakerPersonId?: string;
    capturedVia: Encounter['capturedVia'];
  }): Promise<Encounter>;
  generateDraft(workspaceId: string, personId: string): Promise<FollowUpDraft>;
  syncHubSpotTaskForPerson(workspaceId: string, personId: string): Promise<Task>;
  syncGmailDraftById(workspaceId: string, draftId: string): Promise<FollowUpDraft>;
}

function companyNameForPerson(companies: Company[], companyId?: string): string | undefined {
  return companies.find((company) => company.id === companyId)?.name;
}

class RepositoryBackedFirstSliceService implements FirstSliceService {
  constructor(
    private readonly repository: FirstSliceRepository,
    private readonly generationService: GenerationService
  ) {}

  async ensureDemoWorkspace(): Promise<string> {
    return this.repository.ensureDemoWorkspace();
  }

  async listWorkspaces(): Promise<WorkspaceListItem[]> {
    return this.repository.listWorkspaces();
  }

  async getWorkspaceView(workspaceId: string): Promise<WorkspaceView> {
    const { sourceRecords: _sourceRecords, ...workspace } =
      await this.repository.getWorkspaceViewData(workspaceId);

    return {
      workspace,
      rankedSessions: rankSessions({
        sessions: workspace.sessions,
        persons: workspace.persons,
        targets: workspace.targets
      })
    };
  }

  async ingestCapture(
    workspaceId: string,
    capture: CapturePagePayload
  ): Promise<IngestCaptureBatchResult> {
    return this.repository.ingestCaptureBatch(workspaceId, capture);
  }

  async markTarget(workspaceId: string, personId: string, priority: TargetPriority): Promise<void> {
    await this.repository.upsertTarget({
      workspaceId,
      personId,
      priority,
      why: [`Rep manually marked this person as ${priority.toLowerCase().replaceAll('_', ' ')}`]
    });
  }

  async updateTargetStatus(
    workspaceId: string,
    personId: string,
    status: TargetStatus
  ): Promise<void> {
    await this.repository.updateTargetStatus(workspaceId, personId, status);
  }

  async logEncounter(params: {
    workspaceId: string;
    personId: string;
    noteText: string;
    tags: string[];
    outcome?: 'MET' | 'MISSED';
    sessionId?: string;
    speakerPersonId?: string;
    capturedVia: Encounter['capturedVia'];
  }): Promise<Encounter> {
    const workspace = await this.repository.getWorkspaceViewData(params.workspaceId);
    const person = workspace.persons.find((item) => item.id === params.personId);
    const target = workspace.targets.find((item) => item.personId === params.personId);
    const selectedSession = params.sessionId
      ? workspace.sessions.find((item) => item.id === params.sessionId)
      : undefined;
    const selectedSpeaker = params.speakerPersonId
      ? workspace.persons.find((item) => item.id === params.speakerPersonId)
      : undefined;

    if (!person) {
      throw new Error(`Person ${params.personId} not found.`);
    }

    if (params.sessionId && !selectedSession) {
      throw new Error(`Session ${params.sessionId} not found.`);
    }

    if (params.speakerPersonId && !selectedSpeaker) {
      throw new Error(`Speaker ${params.speakerPersonId} not found.`);
    }

    if (params.speakerPersonId && !params.sessionId) {
      throw new Error('Speaker context requires a session selection.');
    }

    if (
      selectedSession &&
      selectedSpeaker &&
      !selectedSession.speakerPersonIds.includes(selectedSpeaker.id)
    ) {
      throw new Error('Selected speaker is not attached to the selected session.');
    }

    const structured = await this.generationService.structureEncounter({
      event: workspace.event,
      person,
      target,
      companyName: companyNameForPerson(workspace.companies, person.companyId),
      noteText: params.noteText,
      tags: params.tags,
      outcome: params.outcome ?? (target ? 'MET' : undefined),
      session: selectedSession,
      speaker: selectedSpeaker
    });

    return this.repository.createEncounter({
      workspaceId: params.workspaceId,
      personId: params.personId,
      targetId: target?.id,
      outcome: params.outcome ?? (target ? 'MET' : undefined),
      sessionId: params.sessionId,
      speakerPersonId: params.speakerPersonId,
      capturedVia: params.capturedVia,
      noteText: params.noteText,
      structuredSummary: structured.summary,
      nextSteps: structured.nextSteps,
      tags: params.tags,
      generationMetadata: structured.metadata
    });
  }

  async generateDraft(workspaceId: string, personId: string): Promise<FollowUpDraft> {
    const workspace = await this.repository.getWorkspaceViewData(workspaceId);
    const person = workspace.persons.find((item) => item.id === personId);

    if (!person) {
      throw new Error(`Person ${personId} not found.`);
    }

    const encounter = workspace.encounters.find((item) => item.personId === personId);
    const target = workspace.targets.find((item) => item.personId === personId);
    const selectedSession = encounter?.sessionId
      ? workspace.sessions.find((item) => item.id === encounter.sessionId)
      : undefined;
    const selectedSpeaker = encounter?.speakerPersonId
      ? workspace.persons.find((item) => item.id === encounter.speakerPersonId)
      : undefined;
    const draftContent = await this.generationService.generateDraft({
      event: workspace.event,
      person,
      target,
      companyName: companyNameForPerson(workspace.companies, person.companyId),
      encounter,
      session: selectedSession,
      speaker: selectedSpeaker
    });

    return this.repository.saveGeneratedDraft({
      workspaceId,
      personId,
      targetId: target?.id,
      encounterId: encounter?.id,
      subject: draftContent.subject,
      body: draftContent.body,
      summary: draftContent.summary,
      nextSteps: draftContent.nextSteps,
      generationMetadata: draftContent.metadata
    });
  }

  async syncHubSpotTaskForPerson(workspaceId: string, personId: string): Promise<Task> {
    const workspace = await this.repository.getWorkspaceViewData(workspaceId);
    const person = workspace.persons.find((item) => item.id === personId);

    if (!person) {
      throw new Error(`Person ${personId} not found.`);
    }

    const target = workspace.targets.find((item) => item.personId === personId);
    const encounter = workspace.encounters.find((item) => item.personId === personId);
    const title = `Follow up with ${person.fullName}`;
    const body = encounter
      ? `Conference follow-up after ${workspace.event.name}: ${encounter.structuredSummary}`
      : `Conference follow-up after ${workspace.event.name}.`;
    const dueAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString();

    const result = await createHubSpotTask({
      subject: title,
      body,
      dueAt
    });

    return this.repository.saveSyncTaskResult({
      workspaceId,
      personId,
      targetId: target?.id,
      title,
      body,
      dueAt,
      syncResult: {
        mode: result.mode,
        externalId: result.externalId
      }
    });
  }

  async syncGmailDraftById(workspaceId: string, draftId: string): Promise<FollowUpDraft> {
    const workspace = await this.repository.getWorkspaceViewData(workspaceId);
    const draft = workspace.drafts.find((item) => item.id === draftId);

    if (!draft) {
      throw new Error(`Draft ${draftId} not found.`);
    }

    const person = workspace.persons.find((item) => item.id === draft.personId);
    if (!person?.primaryEmail) {
      throw new Error('The selected person needs an email before creating a Gmail draft.');
    }

    const result = await createGmailDraft({
      to: person.primaryEmail,
      subject: draft.subject,
      body: draft.body
    });

    return this.repository.saveSyncDraftResult({
      workspaceId,
      draftId,
      syncResult: {
        mode: result.mode,
        externalId: result.externalId
      }
    });
  }
}

function configuredFirstSliceBackend(): 'file' | 'prisma' {
  const value = process.env.COPILOT_FIRST_SLICE_BACKEND?.trim().toLowerCase();

  if (!value || value === 'file') {
    return 'file';
  }

  if (value === 'prisma') {
    return 'prisma';
  }

  throw new Error(
    `Unsupported COPILOT_FIRST_SLICE_BACKEND value "${process.env.COPILOT_FIRST_SLICE_BACKEND}". Use "file" or "prisma".`
  );
}

function createConfiguredFirstSliceRepository(): FirstSliceRepository {
  return configuredFirstSliceBackend() === 'prisma'
    ? createPrismaFirstSliceRepository()
    : createFileFirstSliceRepository();
}

export function createFirstSliceService(
  repository: FirstSliceRepository = createFileFirstSliceRepository(),
  generationService: GenerationService = createGenerationService()
): FirstSliceService {
  return new RepositoryBackedFirstSliceService(repository, generationService);
}

let defaultFirstSliceService: FirstSliceService | undefined;

export function getFirstSliceService(): FirstSliceService {
  defaultFirstSliceService ??= createFirstSliceService(createConfiguredFirstSliceRepository());
  return defaultFirstSliceService;
}
