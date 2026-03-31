import {
  createId,
  nowIso,
  type CapturePagePayload,
  type DemoStore,
  type Encounter,
  type FollowUpDraft,
  type SourceRecord,
  type Target,
  type TargetStatus,
  type Task,
  DEMO_EVENT,
  DEMO_WORKSPACE
} from '@copilot/core';
import type {
  CreateEncounterRecordInput,
  FirstSliceRepository,
  IngestCaptureBatchResult,
  ReadAuditLogsOptions,
  SaveGeneratedDraftInput,
  SaveSyncDraftResultInput,
  SaveSyncTaskResultInput,
  UpsertTargetInput,
  WorkspaceListItem,
  WorkspaceViewData
} from './first-slice-repository';
import { readDemoStore, savePageHtmlArtifact, writeDemoStore } from './file-demo-store';
import {
  appendAuditLogEntry,
  getWorkspaceOrThrow,
  getWorkspaceSummaryFromStore,
  readAuditLogsFromStore,
  readSourceRecordsFromStore,
  touchWorkspace,
  upsertPersonFromCapture,
  upsertSessionFromCapture
} from './file-first-slice-helpers';

class FileFirstSliceRepository implements FirstSliceRepository {
  async ensureDemoWorkspace(): Promise<string> {
    const store = await readDemoStore();
    const existing = store.workspaces.find((workspace) => workspace.id === DEMO_WORKSPACE.id);
    if (existing) {
      return existing.id;
    }

    store.events.push({ ...DEMO_EVENT });
    store.workspaces.push({ ...DEMO_WORKSPACE });
    appendAuditLogEntry(store, {
      workspaceId: DEMO_WORKSPACE.id,
      action: 'workspace.seeded',
      entityType: 'Workspace',
      entityId: DEMO_WORKSPACE.id,
      metadata: {
        eventId: DEMO_EVENT.id
      }
    });

    await writeDemoStore(store);
    return DEMO_WORKSPACE.id;
  }

  async listWorkspaces(): Promise<WorkspaceListItem[]> {
    const store = await readDemoStore();

    return store.workspaces.map((workspace) => {
      const event = store.events.find((item) => item.id === workspace.eventId);
      if (!event) {
        throw new Error(`Event ${workspace.eventId} not found.`);
      }

      return {
        id: workspace.id,
        name: workspace.name,
        eventName: event.name
      };
    });
  }

  async getWorkspaceViewData(workspaceId: string): Promise<WorkspaceViewData> {
    const store = await readDemoStore();

    return {
      ...getWorkspaceSummaryFromStore(store, workspaceId),
      sourceRecords: readSourceRecordsFromStore(store, workspaceId)
    };
  }

  async ingestCaptureBatch(
    workspaceId: string,
    capture: CapturePagePayload
  ): Promise<IngestCaptureBatchResult> {
    const store = await readDemoStore();
    getWorkspaceOrThrow(store, workspaceId);

    let pageArtifactId: string | undefined;

    if (capture.pageHtml) {
      const artifact = await savePageHtmlArtifact({
        workspaceId,
        content: capture.pageHtml
      });

      store.artifacts.push({
        id: artifact.id,
        workspaceId,
        kind: 'page_html',
        storagePath: artifact.storagePath,
        mimeType: 'text/html',
        byteSize: artifact.byteSize,
        createdAt: nowIso()
      });

      pageArtifactId = artifact.id;
    }

    const batchId = createId('capture');
    store.captureBatches.unshift({
      id: batchId,
      workspaceId,
      portalProvider: capture.portalProvider,
      pageType: capture.pageType,
      pageUrl: capture.pageUrl,
      pageTitle: capture.pageTitle,
      pageTextSummary: capture.pageTextSummary,
      captureMethod: capture.captureMethod,
      pageArtifactId,
      extractorVersion: capture.extractorVersion,
      capturedAt: capture.capturedAt,
      recordCount: capture.records.length
    });

    let addedPeople = 0;
    let addedSessions = 0;
    const sourceRecords: SourceRecord[] = [];

    for (const record of capture.records) {
      const sourceRecordId = createId('source');
      const sourceRecord: SourceRecord = {
        id: sourceRecordId,
        workspaceId,
        captureBatchId: batchId,
        entityType: record.entityType,
        externalKey: record.externalKey,
        raw: record.fields,
        pageUrl: capture.pageUrl,
        pageType: capture.pageType,
        provenance: {
          portalProvider: capture.portalProvider,
          captureMethod: capture.captureMethod,
          pageType: capture.pageType,
          pageUrl: capture.pageUrl,
          pageTitle: capture.pageTitle,
          capturedAt: capture.capturedAt,
          pageTextSummary: capture.pageTextSummary,
          extractorVersion: capture.extractorVersion,
          sourceArtifactId: pageArtifactId,
          sourceArtifactKind: pageArtifactId ? 'page_html' : undefined,
          selectorHints: record.selectorHints
        },
        rawHtmlSnippet: record.rawHtmlSnippet,
        createdAt: capture.capturedAt
      };

      if (record.entityType === 'PERSON') {
        const before = store.persons.length;
        const { person, company } = upsertPersonFromCapture(store, workspaceId, record, sourceRecordId);
        sourceRecord.resolvedPersonId = person.id;
        if (company) {
          sourceRecord.resolvedCompanyId = company.id;
        }
        if (store.persons.length > before) {
          addedPeople += 1;
        }
      }

      if (record.entityType === 'SESSION') {
        const before = store.sessions.length;
        const session = upsertSessionFromCapture(store, workspaceId, record, sourceRecordId);
        sourceRecord.resolvedSessionId = session.id;
        if (store.sessions.length > before) {
          addedSessions += 1;
        }
      }

      sourceRecords.push(sourceRecord);
    }

    this.writeSourceRecordsInStore(store, sourceRecords);
    touchWorkspace(store, workspaceId);
    appendAuditLogEntry(store, {
      workspaceId,
      action: 'capture.ingested',
      entityType: 'CaptureBatch',
      entityId: batchId,
      metadata: {
        totalRecords: capture.records.length,
        pageType: capture.pageType,
        pageUrl: capture.pageUrl
      }
    });

    await writeDemoStore(store);

    return {
      addedPeople,
      addedSessions,
      totalRecords: capture.records.length
    };
  }

  async upsertTarget(input: UpsertTargetInput): Promise<Target> {
    const store = await readDemoStore();
    getWorkspaceOrThrow(store, input.workspaceId);

    const existing = store.targets.find(
      (target) => target.workspaceId === input.workspaceId && target.personId === input.personId
    );

    if (existing) {
      existing.priority = input.priority;
      existing.updatedAt = nowIso();
      existing.status = existing.status === 'MISSED' ? 'TARGETED' : existing.status;

      touchWorkspace(store, input.workspaceId);
      appendAuditLogEntry(store, {
        workspaceId: input.workspaceId,
        action: 'target.updated',
        entityType: 'Target',
        entityId: existing.id,
        metadata: {
          priority: input.priority
        }
      });

      await writeDemoStore(store);
      return existing;
    }

    const target: Target = {
      id: createId('target'),
      workspaceId: input.workspaceId,
      personId: input.personId,
      priority: input.priority,
      status: 'TARGETED',
      why: input.why,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    store.targets.unshift(target);
    touchWorkspace(store, input.workspaceId);
    appendAuditLogEntry(store, {
      workspaceId: input.workspaceId,
      action: 'target.created',
      entityType: 'Target',
      entityId: target.id,
      metadata: {
        priority: input.priority
      }
    });

    await writeDemoStore(store);
    return target;
  }

  async updateTargetStatus(
    workspaceId: string,
    personId: string,
    status: TargetStatus
  ): Promise<Target> {
    const store = await readDemoStore();
    const target = store.targets.find((item) => item.workspaceId === workspaceId && item.personId === personId);

    if (!target) {
      throw new Error(`Target not found for person ${personId}`);
    }

    target.status = status;
    if (status === 'MET') {
      target.metAt = nowIso();
      target.missedAt = undefined;
    }
    if (status === 'MISSED') {
      target.missedAt = nowIso();
    }
    if (status === 'TARGETED') {
      target.metAt = undefined;
      target.missedAt = undefined;
    }
    target.updatedAt = nowIso();

    touchWorkspace(store, workspaceId);
    appendAuditLogEntry(store, {
      workspaceId,
      action: 'target.status_updated',
      entityType: 'Target',
      entityId: target.id,
      metadata: {
        status
      }
    });

    await writeDemoStore(store);
    return target;
  }

  async createEncounter(input: CreateEncounterRecordInput): Promise<Encounter> {
    const store = await readDemoStore();
    getWorkspaceOrThrow(store, input.workspaceId);

    if (input.targetId) {
      const target = store.targets.find((item) => item.id === input.targetId);
      if (target) {
        target.status = 'MET';
        target.metAt = nowIso();
        target.updatedAt = nowIso();
      }
    }

    const encounter: Encounter = {
      id: createId('encounter'),
      workspaceId: input.workspaceId,
      personId: input.personId,
      targetId: input.targetId,
      capturedVia: input.capturedVia,
      noteText: input.noteText,
      structuredSummary: input.structuredSummary,
      nextSteps: input.nextSteps,
      tags: input.tags,
      createdAt: nowIso()
    };

    store.encounters.unshift(encounter);
    touchWorkspace(store, input.workspaceId);
    appendAuditLogEntry(store, {
      workspaceId: input.workspaceId,
      action: 'encounter.logged',
      entityType: 'Encounter',
      entityId: encounter.id,
      metadata: {
        personId: input.personId,
        tags: input.tags
      }
    });

    await writeDemoStore(store);
    return encounter;
  }

  async saveGeneratedDraft(input: SaveGeneratedDraftInput): Promise<FollowUpDraft> {
    const store = await readDemoStore();

    const draft: FollowUpDraft = {
      id: createId('draft'),
      workspaceId: input.workspaceId,
      personId: input.personId,
      targetId: input.targetId,
      encounterId: input.encounterId,
      subject: input.subject,
      body: input.body,
      summary: input.summary,
      nextSteps: input.nextSteps,
      status: 'GENERATED',
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    store.drafts.unshift(draft);
    touchWorkspace(store, input.workspaceId);
    appendAuditLogEntry(store, {
      workspaceId: input.workspaceId,
      action: 'draft.generated',
      entityType: 'FollowUpDraft',
      entityId: draft.id,
      metadata: {
        personId: input.personId,
        encounterId: input.encounterId ?? null
      }
    });

    await writeDemoStore(store);
    return draft;
  }

  async saveSyncTaskResult(input: SaveSyncTaskResultInput): Promise<Task> {
    const store = await readDemoStore();

    const task: Task = {
      id: createId('task'),
      workspaceId: input.workspaceId,
      personId: input.personId,
      targetId: input.targetId,
      title: input.title,
      body: input.body,
      dueAt: input.dueAt,
      status: 'SYNCED',
      hubspotTaskId: input.syncResult.externalId,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    store.tasks.unshift(task);
    touchWorkspace(store, input.workspaceId);
    appendAuditLogEntry(store, {
      workspaceId: input.workspaceId,
      action: 'hubspot.task_synced',
      entityType: 'Task',
      entityId: task.id,
      metadata: {
        personId: input.personId,
        mode: input.syncResult.mode,
        externalId: input.syncResult.externalId
      }
    });

    await writeDemoStore(store);
    return task;
  }

  async saveSyncDraftResult(input: SaveSyncDraftResultInput): Promise<FollowUpDraft> {
    const store = await readDemoStore();
    const draft = store.drafts.find((item) => item.workspaceId === input.workspaceId && item.id === input.draftId);

    if (!draft) {
      throw new Error(`Draft ${input.draftId} not found.`);
    }

    draft.gmailDraftId = input.syncResult.externalId;
    draft.status = 'SYNCED';
    draft.updatedAt = nowIso();

    const personId = draft.personId;

    touchWorkspace(store, input.workspaceId);
    appendAuditLogEntry(store, {
      workspaceId: input.workspaceId,
      action: 'gmail.draft_synced',
      entityType: 'FollowUpDraft',
      entityId: draft.id,
      metadata: {
        personId,
        mode: input.syncResult.mode,
        externalId: input.syncResult.externalId
      }
    });

    await writeDemoStore(store);
    return draft;
  }

  async writeAuditLog(input: import('./first-slice-repository').AuditLogWriteInput) {
    const store = await readDemoStore();
    const entry = appendAuditLogEntry(store, input);
    await writeDemoStore(store);
    return entry;
  }

  async readAuditLogs(workspaceId: string, options?: ReadAuditLogsOptions) {
    const store = await readDemoStore();
    return readAuditLogsFromStore(store, workspaceId, options);
  }

  async writeSourceRecords(records: SourceRecord[]): Promise<SourceRecord[]> {
    const store = await readDemoStore();
    this.writeSourceRecordsInStore(store, records);
    await writeDemoStore(store);
    return records;
  }

  async readSourceRecords(workspaceId: string): Promise<SourceRecord[]> {
    const store = await readDemoStore();
    return readSourceRecordsFromStore(store, workspaceId);
  }

  private writeSourceRecordsInStore(store: DemoStore, records: SourceRecord[]): void {
    for (const record of records) {
      store.sourceRecords.unshift(record);
    }
  }
}

export function createFileFirstSliceRepository(): FirstSliceRepository {
  return new FileFirstSliceRepository();
}
