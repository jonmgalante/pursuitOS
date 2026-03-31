export type PortalProvider = 'GRIP';
export type WorkspaceMode = 'PRE_EVENT' | 'IN_EVENT' | 'POST_EVENT';
export type CaptureMethod = 'DOM' | 'SCREENSHOT';
export type CapturePageType =
  | 'ATTENDEE_LIST'
  | 'ATTENDEE_PROFILE'
  | 'SPEAKER_LIST'
  | 'SPEAKER_PROFILE'
  | 'SESSION_LIST'
  | 'SESSION_PROFILE'
  | 'UNKNOWN';
export type SourceEntityType = 'PERSON' | 'SESSION';
export type TargetPriority = 'MUST_MEET' | 'NICE_TO_MEET' | 'BACKUP';
export type TargetStatus = 'TARGETED' | 'MET' | 'MISSED';
export type EncounterChannel = 'MANUAL' | 'VOICE';
export type MatchMethod =
  | 'NONE'
  | 'DETERMINISTIC_EMAIL'
  | 'DETERMINISTIC_DOMAIN'
  | 'DETERMINISTIC_COMPANY'
  | 'FUZZY_COMPANY'
  | 'AI_DISAMBIGUATION'
  | 'MANUAL';

export interface Event {
  id: string;
  name: string;
  venue?: string;
  city?: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  portalProvider: PortalProvider;
}

export interface Workspace {
  id: string;
  eventId: string;
  name: string;
  ownerUserKey?: string;
  portalProvider: PortalProvider;
  mode: WorkspaceMode;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  workspaceId: string;
  name: string;
  normalizedName: string;
  domain?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  workspaceId: string;
  companyId?: string;
  fullName: string;
  title?: string;
  primaryEmail?: string;
  isAttendee: boolean;
  isSpeaker: boolean;
  hubspotContactId?: string;
  matchMethod: MatchMethod;
  sourceRecordIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  location?: string;
  startsAt?: string;
  endsAt?: string;
  speakerPersonIds: string[];
  sourceRecordIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Artifact {
  id: string;
  workspaceId: string;
  kind: 'page_html' | 'screenshot' | 'audio' | 'transcript';
  storagePath: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
}

export interface CaptureBatch {
  id: string;
  workspaceId: string;
  portalProvider: PortalProvider;
  pageType: CapturePageType;
  pageUrl: string;
  pageTitle: string;
  captureMethod: CaptureMethod;
  pageArtifactId?: string;
  capturedAt: string;
  recordCount: number;
}

export interface Provenance {
  portalProvider: PortalProvider;
  captureMethod: CaptureMethod;
  pageType: CapturePageType;
  pageUrl: string;
  pageTitle: string;
  capturedAt: string;
  extractorVersion: string;
  selectorHints: string[];
}

export interface SourceRecord {
  id: string;
  workspaceId: string;
  captureBatchId: string;
  entityType: SourceEntityType;
  externalKey?: string;
  raw: Record<string, unknown>;
  pageUrl: string;
  pageType: CapturePageType;
  provenance: Provenance;
  rawHtmlSnippet?: string;
  resolvedPersonId?: string;
  resolvedSessionId?: string;
  resolvedCompanyId?: string;
  createdAt: string;
}

export interface Target {
  id: string;
  workspaceId: string;
  personId: string;
  priority: TargetPriority;
  status: TargetStatus;
  why: string[];
  createdAt: string;
  updatedAt: string;
  metAt?: string;
  missedAt?: string;
}

export interface Encounter {
  id: string;
  workspaceId: string;
  personId: string;
  targetId?: string;
  capturedVia: EncounterChannel;
  noteText: string;
  structuredSummary: string;
  nextSteps: string[];
  tags: string[];
  createdAt: string;
}

export interface FollowUpDraft {
  id: string;
  workspaceId: string;
  personId: string;
  targetId?: string;
  encounterId?: string;
  subject: string;
  body: string;
  summary: string;
  nextSteps: string[];
  status: 'GENERATED' | 'SYNCED';
  gmailDraftId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  personId: string;
  targetId?: string;
  title: string;
  body: string;
  dueAt: string;
  status: 'OPEN' | 'SYNCED';
  hubspotTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface HubSpotDirectoryRecord {
  id: string;
  email?: string;
  companyDomain?: string;
  companyName?: string;
}

export interface DemoStore {
  version: number;
  events: Event[];
  workspaces: Workspace[];
  companies: Company[];
  persons: Person[];
  sessions: Session[];
  artifacts: Artifact[];
  captureBatches: CaptureBatch[];
  sourceRecords: SourceRecord[];
  targets: Target[];
  encounters: Encounter[];
  drafts: FollowUpDraft[];
  tasks: Task[];
  auditLogs: AuditLog[];
  hubspotDirectory: HubSpotDirectoryRecord[];
}

export interface CaptureRecord {
  entityType: SourceEntityType;
  externalKey?: string;
  fields: Record<string, unknown>;
  rawHtmlSnippet?: string;
  selectorHints: string[];
}

export interface CapturePagePayload {
  portalProvider: PortalProvider;
  captureMethod: CaptureMethod;
  pageType: CapturePageType;
  pageUrl: string;
  pageTitle: string;
  pageHtml?: string;
  extractorVersion: string;
  records: CaptureRecord[];
}

export interface RankedSession extends Session {
  score: number;
  reasons: string[];
  speakerNames: string[];
}
