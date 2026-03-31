import { createGmailDraft, createHubSpotTask } from '@copilot/connectors';
import {
  generateFollowUpDraft,
  rankSessions,
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
    capturedVia: Encounter['capturedVia'];
  }): Promise<Encounter>;
  generateDraft(workspaceId: string, personId: string): Promise<FollowUpDraft>;
  syncHubSpotTaskForPerson(workspaceId: string, personId: string): Promise<Task>;
  syncGmailDraftById(workspaceId: string, draftId: string): Promise<FollowUpDraft>;
}

function summarizeEncounter(noteText: string): { summary: string; nextSteps: string[] } {
  const summary = noteText
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(' ')
    .trim();

  const nextSteps: string[] = [];
  const lower = noteText.toLowerCase();

  if (lower.includes('demo')) {
    nextSteps.push('Schedule a demo follow-up.');
  }
  if (lower.includes('intro') || lower.includes('introduce')) {
    nextSteps.push('Send the promised introduction.');
  }
  if (lower.includes('pricing') || lower.includes('budget')) {
    nextSteps.push('Share pricing details or route the pricing follow-up.');
  }
  if (nextSteps.length === 0) {
    nextSteps.push('Send a short recap and propose one concrete next step.');
  }

  return {
    summary: summary || noteText,
    nextSteps
  };
}

function firstName(fullName: string): string {
  return fullName.split(/\s+/)[0] ?? fullName;
}

class RepositoryBackedFirstSliceService implements FirstSliceService {
  constructor(private readonly repository: FirstSliceRepository) {}

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
    capturedVia: Encounter['capturedVia'];
  }): Promise<Encounter> {
    const workspace = await this.repository.getWorkspaceViewData(params.workspaceId);
    const target = workspace.targets.find((item) => item.personId === params.personId);
    const structured = summarizeEncounter(params.noteText);

    return this.repository.createEncounter({
      workspaceId: params.workspaceId,
      personId: params.personId,
      targetId: target?.id,
      capturedVia: params.capturedVia,
      noteText: params.noteText,
      structuredSummary: structured.summary,
      nextSteps: structured.nextSteps,
      tags: params.tags
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

    const draftContent = encounter
      ? generateFollowUpDraft({
          event: workspace.event,
          person,
          encounter
        })
      : {
          subject: `Nice to connect before ${workspace.event.name}, ${firstName(person.fullName)}`,
          body: [
            `Hi ${firstName(person.fullName)},`,
            '',
            `I noticed you in the attendee list for ${workspace.event.name}.`,
            `I would love to connect briefly during the event if it is relevant for ${person.title ?? 'your role'}.`,
            '',
            `If helpful, I can send over a short agenda or suggest a time to meet on-site.`,
            '',
            'Best,',
            'Your Name'
          ].join('\n'),
          summary: 'Pre-event outreach draft generated because no encounter note exists yet.',
          nextSteps: ['Propose a short event meeting or exchange a quick agenda.']
        };

    return this.repository.saveGeneratedDraft({
      workspaceId,
      personId,
      targetId: target?.id,
      encounterId: encounter?.id,
      subject: draftContent.subject,
      body: draftContent.body,
      summary: draftContent.summary,
      nextSteps: draftContent.nextSteps
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
  repository: FirstSliceRepository = createFileFirstSliceRepository()
): FirstSliceService {
  return new RepositoryBackedFirstSliceService(repository);
}

let defaultFirstSliceService: FirstSliceService | undefined;

export function getFirstSliceService(): FirstSliceService {
  defaultFirstSliceService ??= createFirstSliceService(createConfiguredFirstSliceRepository());
  return defaultFirstSliceService;
}
