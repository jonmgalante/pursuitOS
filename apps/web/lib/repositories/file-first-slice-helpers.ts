import {
  createId,
  deterministicHubSpotMatch,
  normalizeCompanyName,
  nowIso,
  type AuditLog,
  type CaptureRecord,
  type Company,
  type DemoStore,
  type Event,
  type Person,
  type Session,
  type SourceRecord
} from '@copilot/core';
import type { AuditLogWriteInput, ReadAuditLogsOptions, WorkspaceSummary } from './first-slice-repository';

export function appendAuditLogEntry(store: DemoStore, input: AuditLogWriteInput): AuditLog {
  const entry: AuditLog = {
    id: createId('audit'),
    workspaceId: input.workspaceId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata,
    createdAt: nowIso()
  };

  store.auditLogs.unshift(entry);
  return entry;
}

export function readAuditLogsFromStore(
  store: DemoStore,
  workspaceId: string,
  options?: ReadAuditLogsOptions
): AuditLog[] {
  const limit = options?.limit ?? 20;
  return store.auditLogs.filter((entry) => entry.workspaceId === workspaceId).slice(0, limit);
}

export function readSourceRecordsFromStore(store: DemoStore, workspaceId: string): SourceRecord[] {
  return store.sourceRecords.filter((record) => record.workspaceId === workspaceId);
}

export function getWorkspaceOrThrow(store: DemoStore, workspaceId: string) {
  const workspace = store.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found.`);
  }

  return workspace;
}

export function getEventOrThrow(store: DemoStore, eventId: string): Event {
  const event = store.events.find((item) => item.id === eventId);
  if (!event) {
    throw new Error(`Event ${eventId} not found.`);
  }

  return event;
}

export function touchWorkspace(store: DemoStore, workspaceId: string): void {
  const workspace = getWorkspaceOrThrow(store, workspaceId);
  workspace.updatedAt = nowIso();
}

function companyDomainFromEmail(email?: string): string | undefined {
  return email?.split('@')[1]?.toLowerCase();
}

function personNameKey(fullName?: string): string {
  return (fullName ?? '').trim().toLowerCase();
}

function upsertCompany(
  store: DemoStore,
  workspaceId: string,
  companyName?: string,
  fallbackDomain?: string
): Company | undefined {
  if (!companyName?.trim()) {
    return undefined;
  }

  const normalizedName = normalizeCompanyName(companyName);
  const existing = store.companies.find(
    (company) => company.workspaceId === workspaceId && company.normalizedName === normalizedName
  );

  if (existing) {
    if (!existing.domain && fallbackDomain) {
      existing.domain = fallbackDomain;
      existing.updatedAt = nowIso();
    }

    return existing;
  }

  const created: Company = {
    id: createId('company'),
    workspaceId,
    name: companyName.trim(),
    normalizedName,
    domain: fallbackDomain,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  store.companies.push(created);
  return created;
}

function updatePersonFromFields(person: Person, record: CaptureRecord, companyId?: string): void {
  const fullName = String(record.fields.fullName ?? '').trim();
  const title = record.fields.title ? String(record.fields.title) : undefined;
  const email = record.fields.email ? String(record.fields.email) : undefined;
  const isSpeaker = Boolean(record.fields.isSpeaker);
  const isAttendee = record.fields.isAttendee !== false;

  if (!person.fullName && fullName) {
    person.fullName = fullName;
  }

  if (!person.title && title) {
    person.title = title;
  }

  if (!person.primaryEmail && email) {
    person.primaryEmail = email;
  }

  if (!person.companyId && companyId) {
    person.companyId = companyId;
  }

  person.isSpeaker = person.isSpeaker || isSpeaker;
  person.isAttendee = person.isAttendee || isAttendee;
  person.updatedAt = nowIso();
}

function findExistingPerson(
  store: DemoStore,
  workspaceId: string,
  record: CaptureRecord,
  companyId?: string
): Person | undefined {
  const email = record.fields.email ? String(record.fields.email).toLowerCase() : undefined;
  const fullName = personNameKey(record.fields.fullName ? String(record.fields.fullName) : undefined);

  if (email) {
    const byEmail = store.persons.find(
      (person) => person.workspaceId === workspaceId && person.primaryEmail?.toLowerCase() === email
    );
    if (byEmail) {
      return byEmail;
    }
  }

  if (fullName && companyId) {
    const byNameAndCompany = store.persons.find(
      (person) =>
        person.workspaceId === workspaceId &&
        person.companyId === companyId &&
        personNameKey(person.fullName) === fullName
    );
    if (byNameAndCompany) {
      return byNameAndCompany;
    }
  }

  if (fullName) {
    const byName = store.persons.find(
      (person) => person.workspaceId === workspaceId && personNameKey(person.fullName) === fullName
    );
    if (byName) {
      return byName;
    }
  }

  return undefined;
}

function matchPersonToHubSpot(store: DemoStore, person: Person, company?: Company): void {
  const result = deterministicHubSpotMatch(
    {
      primaryEmail: person.primaryEmail,
      fullName: person.fullName,
      companyName: company?.name
    },
    store.hubspotDirectory
  );

  if (result.hubspotContactId) {
    person.hubspotContactId = result.hubspotContactId;
  }

  person.matchMethod = result.matchMethod;
}

export function upsertPersonFromCapture(
  store: DemoStore,
  workspaceId: string,
  record: CaptureRecord,
  sourceRecordId: string
): { person: Person; company?: Company } {
  const email = record.fields.email ? String(record.fields.email) : undefined;
  const companyName = record.fields.companyName ? String(record.fields.companyName) : undefined;
  const company = upsertCompany(store, workspaceId, companyName, companyDomainFromEmail(email));
  const existing = findExistingPerson(store, workspaceId, record, company?.id);

  if (existing) {
    updatePersonFromFields(existing, record, company?.id);
    if (!existing.sourceRecordIds.includes(sourceRecordId)) {
      existing.sourceRecordIds.push(sourceRecordId);
    }
    matchPersonToHubSpot(store, existing, company);
    return { person: existing, company };
  }

  const created: Person = {
    id: createId('person'),
    workspaceId,
    companyId: company?.id,
    fullName: String(record.fields.fullName ?? 'Unknown Person').trim(),
    title: record.fields.title ? String(record.fields.title) : undefined,
    primaryEmail: email,
    isAttendee: record.fields.isAttendee !== false,
    isSpeaker: Boolean(record.fields.isSpeaker),
    hubspotContactId: undefined,
    matchMethod: 'NONE',
    sourceRecordIds: [sourceRecordId],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  matchPersonToHubSpot(store, created, company);
  store.persons.push(created);

  return { person: created, company };
}

function sessionIdentityKey(title?: string, startsAt?: string): string {
  return `${(title ?? '').trim().toLowerCase()}::${startsAt ?? ''}`;
}

function findOrCreateSpeakerPerson(store: DemoStore, workspaceId: string, speakerName: string): Person {
  const existing = store.persons.find(
    (person) =>
      person.workspaceId === workspaceId &&
      personNameKey(person.fullName) === personNameKey(speakerName)
  );

  if (existing) {
    existing.isSpeaker = true;
    existing.updatedAt = nowIso();
    return existing;
  }

  const created: Person = {
    id: createId('person'),
    workspaceId,
    fullName: speakerName,
    title: undefined,
    primaryEmail: undefined,
    isAttendee: false,
    isSpeaker: true,
    hubspotContactId: undefined,
    matchMethod: 'NONE',
    sourceRecordIds: [],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  store.persons.push(created);
  return created;
}

export function upsertSessionFromCapture(
  store: DemoStore,
  workspaceId: string,
  record: CaptureRecord,
  sourceRecordId: string
): Session {
  const title = record.fields.title ? String(record.fields.title) : 'Untitled Session';
  const startsAt = record.fields.startsAt ? String(record.fields.startsAt) : undefined;
  const key = sessionIdentityKey(title, startsAt);

  const existing = store.sessions.find(
    (session) => session.workspaceId === workspaceId && sessionIdentityKey(session.title, session.startsAt) === key
  );

  const speakerNames = Array.isArray(record.fields.speakerNames)
    ? record.fields.speakerNames.map((speaker) => String(speaker))
    : [];

  const speakerPersonIds = speakerNames.map((speakerName) =>
    findOrCreateSpeakerPerson(store, workspaceId, speakerName).id
  );

  if (existing) {
    existing.description ??= record.fields.description ? String(record.fields.description) : undefined;
    existing.location ??= record.fields.location ? String(record.fields.location) : undefined;
    existing.endsAt ??= record.fields.endsAt ? String(record.fields.endsAt) : undefined;
    existing.speakerPersonIds = Array.from(new Set([...existing.speakerPersonIds, ...speakerPersonIds]));
    if (!existing.sourceRecordIds.includes(sourceRecordId)) {
      existing.sourceRecordIds.push(sourceRecordId);
    }
    existing.updatedAt = nowIso();
    return existing;
  }

  const created: Session = {
    id: createId('session'),
    workspaceId,
    title,
    description: record.fields.description ? String(record.fields.description) : undefined,
    location: record.fields.location ? String(record.fields.location) : undefined,
    startsAt,
    endsAt: record.fields.endsAt ? String(record.fields.endsAt) : undefined,
    speakerPersonIds,
    sourceRecordIds: [sourceRecordId],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  store.sessions.push(created);
  return created;
}

export function getWorkspaceSummaryFromStore(store: DemoStore, workspaceId: string): WorkspaceSummary {
  const workspace = getWorkspaceOrThrow(store, workspaceId);
  const event = getEventOrThrow(store, workspace.eventId);
  const companies = store.companies.filter((company) => company.workspaceId === workspaceId);
  const persons = store.persons.filter((person) => person.workspaceId === workspaceId);
  const sessions = store.sessions.filter((session) => session.workspaceId === workspaceId);
  const targets = store.targets.filter((target) => target.workspaceId === workspaceId);
  const encounters = store.encounters.filter((encounter) => encounter.workspaceId === workspaceId);
  const drafts = store.drafts.filter((draft) => draft.workspaceId === workspaceId);
  const tasks = store.tasks.filter((task) => task.workspaceId === workspaceId);
  const captureBatches = store.captureBatches.filter((batch) => batch.workspaceId === workspaceId);
  const auditLogs = readAuditLogsFromStore(store, workspaceId);

  return {
    workspace,
    event,
    companies,
    persons,
    sessions,
    targets,
    encounters,
    drafts,
    tasks,
    captureBatches,
    auditLogs
  };
}
