import type {
  AuditLog,
  CaptureBatch,
  CapturePagePayload,
  Company,
  Encounter,
  Event,
  FollowUpDraft,
  GenerationMetadata,
  Person,
  Session,
  SourceRecord,
  Target,
  TargetPriority,
  TargetStatus,
  Task,
  Workspace
} from '@copilot/core';

export interface WorkspaceListItem {
  id: string;
  name: string;
  eventName: string;
}

export interface WorkspaceSummary {
  workspace: Workspace;
  event: Event;
  companies: Company[];
  persons: Person[];
  sessions: Session[];
  targets: Target[];
  encounters: Encounter[];
  drafts: FollowUpDraft[];
  tasks: Task[];
  captureBatches: CaptureBatch[];
  auditLogs: AuditLog[];
}

export interface WorkspaceViewData extends WorkspaceSummary {
  sourceRecords: SourceRecord[];
}

export interface IngestCaptureBatchResult {
  addedPeople: number;
  addedSessions: number;
  totalRecords: number;
}

export interface UpsertTargetInput {
  workspaceId: string;
  personId: string;
  priority: TargetPriority;
  why: string[];
}

export interface CreateEncounterRecordInput {
  workspaceId: string;
  personId: string;
  targetId?: string;
  outcome?: 'MET' | 'MISSED';
  sessionId?: string;
  speakerPersonId?: string;
  capturedVia: Encounter['capturedVia'];
  noteText: string;
  structuredSummary: string;
  nextSteps: string[];
  tags: string[];
  generationMetadata: GenerationMetadata;
}

export interface SaveGeneratedDraftInput {
  workspaceId: string;
  personId: string;
  targetId?: string;
  encounterId?: string;
  subject: string;
  body: string;
  summary: string;
  nextSteps: string[];
  generationMetadata: GenerationMetadata;
}

export interface ConnectorSyncResult {
  mode: 'mock' | 'live';
  externalId: string;
}

export interface SaveSyncTaskResultInput {
  workspaceId: string;
  personId: string;
  targetId?: string;
  title: string;
  body: string;
  dueAt: string;
  syncResult: ConnectorSyncResult;
}

export interface SaveSyncDraftResultInput {
  workspaceId: string;
  draftId: string;
  syncResult: ConnectorSyncResult;
}

export interface AuditLogWriteInput {
  workspaceId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
}

export interface ReadAuditLogsOptions {
  limit?: number;
}

export interface FirstSliceRepository {
  ensureDemoWorkspace(): Promise<string>;
  listWorkspaces(): Promise<WorkspaceListItem[]>;
  getWorkspaceViewData(workspaceId: string): Promise<WorkspaceViewData>;
  ingestCaptureBatch(
    workspaceId: string,
    capture: CapturePagePayload
  ): Promise<IngestCaptureBatchResult>;
  upsertTarget(input: UpsertTargetInput): Promise<Target>;
  updateTargetStatus(workspaceId: string, personId: string, status: TargetStatus): Promise<Target>;
  createEncounter(input: CreateEncounterRecordInput): Promise<Encounter>;
  saveGeneratedDraft(input: SaveGeneratedDraftInput): Promise<FollowUpDraft>;
  saveSyncTaskResult(input: SaveSyncTaskResultInput): Promise<Task>;
  saveSyncDraftResult(input: SaveSyncDraftResultInput): Promise<FollowUpDraft>;
  writeAuditLog(input: AuditLogWriteInput): Promise<AuditLog>;
  readAuditLogs(workspaceId: string, options?: ReadAuditLogsOptions): Promise<AuditLog[]>;
  writeSourceRecords(records: SourceRecord[]): Promise<SourceRecord[]>;
  readSourceRecords(workspaceId: string): Promise<SourceRecord[]>;
}
