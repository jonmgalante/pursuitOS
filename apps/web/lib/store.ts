import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createGmailDraft, createHubSpotTask } from '@copilot/connectors';
import {
  createId,
  deterministicHubSpotMatch,
  type CapturePagePayload,
  type CaptureRecord,
  type Company,
  type DemoStore,
  type Encounter,
  type Event,
  type FollowUpDraft,
  type Person,
  type RankedSession,
  type Session,
  type SourceRecord,
  type Target,
  type TargetPriority,
  type TargetStatus,
  type Task,
  DEMO_ATTENDEES,
  DEMO_EVENT,
  DEMO_HUBSPOT_DIRECTORY,
  DEMO_SESSIONS,
  DEMO_WORKSPACE,
  generateFollowUpDraft,
  normalizeCompanyName,
  nowIso,
  rankSessions
} from '@copilot/core';

const STORE_DIR = path.join(process.cwd(), '.data');
const STORE_PATH = path.join(STORE_DIR, 'demo-store.json');
const ARTIFACTS_DIR = path.join(process.cwd(), '.artifacts');

function emptyStore(): DemoStore {
  return {
    version: 1,
    events: [],
    workspaces: [],
    companies: [],
    persons: [],
    sessions: [],
    artifacts: [],
    captureBatches: [],
    sourceRecords: [],
    targets: [],
    encounters: [],
    drafts: [],
    tasks: [],
    auditLogs: [],
    hubspotDirectory: [...DEMO_HUBSPOT_DIRECTORY]
  };
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
}

export async function readStore(): Promise<DemoStore> {
  await ensureDirs();

  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    return JSON.parse(raw) as DemoStore;
  } catch {
    const store = emptyStore();
    await writeStore(store);
    return store;
  }
}

export async function writeStore(store: DemoStore): Promise<void> {
  await ensureDirs();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function addAuditLog(
  store: DemoStore,
  workspaceId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>
): void {
  store.auditLogs.unshift({
    id: createId('audit'),
    workspaceId,
    action,
    entityType,
    entityId,
    metadata,
    createdAt: nowIso()
  });
}

function getWorkspaceOrThrow(store: DemoStore, workspaceId: string) {
  const workspace = store.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found.`);
  }
  return workspace;
}

function getEventOrThrow(store: DemoStore, eventId: string): Event {
  const event = store.events.find((item) => item.id === eventId);
  if (!event) {
    throw new Error(`Event ${eventId} not found.`);
  }
  return event;
}

function touchWorkspace(store: DemoStore, workspaceId: string): void {
  const workspace = getWorkspaceOrThrow(store, workspaceId);
  workspace.updatedAt = nowIso();
}

function companyDomainFromEmail(email?: string): string | undefined {
  return email?.split('@')[1]?.toLowerCase();
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

function updatePersonFromFields(
  person: Person,
  record: CaptureRecord,
  companyId?: string
): void {
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

function personNameKey(fullName?: string): string {
  return (fullName ?? '').trim().toLowerCase();
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

function upsertPerson(
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

function findOrCreateSpeakerPerson(
  store: DemoStore,
  workspaceId: string,
  speakerName: string
): Person {
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

function upsertSession(
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

async function saveArtifact(params: {
  workspaceId: string;
  kind: 'page_html';
  content: string;
  extension: 'html';
  mimeType: string;
}): Promise<{ id: string; storagePath: string; byteSize: number }> {
  const folder = path.join(ARTIFACTS_DIR, params.workspaceId);
  await fs.mkdir(folder, { recursive: true });
  const artifactId = createId('artifact');
  const filePath = path.join(folder, `${artifactId}.${params.extension}`);
  await fs.writeFile(filePath, params.content, 'utf-8');
  const byteSize = Buffer.byteLength(params.content, 'utf-8');

  return {
    id: artifactId,
    storagePath: filePath,
    byteSize
  };
}

export async function ensureDemoWorkspace(): Promise<string> {
  const store = await readStore();
  const existing = store.workspaces.find((workspace) => workspace.id === DEMO_WORKSPACE.id);
  if (existing) {
    return existing.id;
  }

  store.events.push({ ...DEMO_EVENT });
  store.workspaces.push({ ...DEMO_WORKSPACE });
  addAuditLog(store, DEMO_WORKSPACE.id, 'workspace.seeded', 'Workspace', DEMO_WORKSPACE.id, {
    eventId: DEMO_EVENT.id
  });

  await writeStore(store);
  return DEMO_WORKSPACE.id;
}

export async function listWorkspaces(): Promise<Array<{ id: string; name: string; eventName: string }>> {
  const store = await readStore();

  return store.workspaces.map((workspace) => {
    const event = getEventOrThrow(store, workspace.eventId);
    return {
      id: workspace.id,
      name: workspace.name,
      eventName: event.name
    };
  });
}

export async function getWorkspaceView(workspaceId: string): Promise<{
  workspace: ReturnType<typeof getWorkspaceSummarySync>;
  rankedSessions: RankedSession[];
}> {
  const store = await readStore();
  return getWorkspaceViewFromStore(store, workspaceId);
}

function getWorkspaceSummarySync(store: DemoStore, workspaceId: string) {
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
  const auditLogs = store.auditLogs.filter((entry) => entry.workspaceId === workspaceId).slice(0, 20);

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

function getWorkspaceViewFromStore(store: DemoStore, workspaceId: string) {
  const summary = getWorkspaceSummarySync(store, workspaceId);
  const rankedSessions = rankSessions({
    sessions: summary.sessions,
    persons: summary.persons,
    targets: summary.targets
  });

  return {
    workspace: summary,
    rankedSessions
  };
}

export async function ingestCapture(workspaceId: string, capture: CapturePagePayload): Promise<{
  addedPeople: number;
  addedSessions: number;
  totalRecords: number;
}> {
  const store = await readStore();
  getWorkspaceOrThrow(store, workspaceId);

  let pageArtifactId: string | undefined;

  if (capture.pageHtml) {
    const artifact = await saveArtifact({
      workspaceId,
      kind: 'page_html',
      content: capture.pageHtml,
      extension: 'html',
      mimeType: 'text/html'
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
    captureMethod: capture.captureMethod,
    pageArtifactId,
    capturedAt: nowIso(),
    recordCount: capture.records.length
  });

  let addedPeople = 0;
  let addedSessions = 0;

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
        capturedAt: nowIso(),
        extractorVersion: capture.extractorVersion,
        selectorHints: record.selectorHints
      },
      rawHtmlSnippet: record.rawHtmlSnippet,
      createdAt: nowIso()
    };

    if (record.entityType === 'PERSON') {
      const before = store.persons.length;
      const { person, company } = upsertPerson(store, workspaceId, record, sourceRecordId);
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
      const session = upsertSession(store, workspaceId, record, sourceRecordId);
      sourceRecord.resolvedSessionId = session.id;
      if (store.sessions.length > before) {
        addedSessions += 1;
      }
    }

    store.sourceRecords.unshift(sourceRecord);
  }

  touchWorkspace(store, workspaceId);
  addAuditLog(store, workspaceId, 'capture.ingested', 'CaptureBatch', batchId, {
    totalRecords: capture.records.length,
    pageType: capture.pageType,
    pageUrl: capture.pageUrl
  });

  await writeStore(store);

  return {
    addedPeople,
    addedSessions,
    totalRecords: capture.records.length
  };
}

export async function markTarget(workspaceId: string, personId: string, priority: TargetPriority): Promise<void> {
  const store = await readStore();
  getWorkspaceOrThrow(store, workspaceId);

  const existing = store.targets.find(
    (target) => target.workspaceId === workspaceId && target.personId === personId
  );

  if (existing) {
    existing.priority = priority;
    existing.updatedAt = nowIso();
    existing.status = existing.status === 'MISSED' ? 'TARGETED' : existing.status;
    addAuditLog(store, workspaceId, 'target.updated', 'Target', existing.id, {
      priority
    });
  } else {
    const target: Target = {
      id: createId('target'),
      workspaceId,
      personId,
      priority,
      status: 'TARGETED',
      why: [`Rep manually marked this person as ${priority.toLowerCase().replaceAll('_', ' ')}`],
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    store.targets.unshift(target);
    addAuditLog(store, workspaceId, 'target.created', 'Target', target.id, {
      priority
    });
  }

  touchWorkspace(store, workspaceId);
  await writeStore(store);
}

export async function updateTargetStatus(
  workspaceId: string,
  personId: string,
  status: TargetStatus
): Promise<void> {
  const store = await readStore();
  const target = store.targets.find(
    (item) => item.workspaceId === workspaceId && item.personId === personId
  );

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
  addAuditLog(store, workspaceId, 'target.status_updated', 'Target', target.id, {
    status
  });

  await writeStore(store);
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

export async function logEncounter(params: {
  workspaceId: string;
  personId: string;
  noteText: string;
  tags: string[];
  capturedVia: Encounter['capturedVia'];
}): Promise<Encounter> {
  const store = await readStore();
  getWorkspaceOrThrow(store, params.workspaceId);

  const target = store.targets.find(
    (item) => item.workspaceId === params.workspaceId && item.personId === params.personId
  );

  if (target) {
    target.status = 'MET';
    target.metAt = nowIso();
    target.updatedAt = nowIso();
  }

  const structured = summarizeEncounter(params.noteText);

  const encounter: Encounter = {
    id: createId('encounter'),
    workspaceId: params.workspaceId,
    personId: params.personId,
    targetId: target?.id,
    capturedVia: params.capturedVia,
    noteText: params.noteText,
    structuredSummary: structured.summary,
    nextSteps: structured.nextSteps,
    tags: params.tags,
    createdAt: nowIso()
  };

  store.encounters.unshift(encounter);
  touchWorkspace(store, params.workspaceId);
  addAuditLog(store, params.workspaceId, 'encounter.logged', 'Encounter', encounter.id, {
    personId: params.personId,
    tags: params.tags
  });

  await writeStore(store);
  return encounter;
}

export async function generateDraft(workspaceId: string, personId: string): Promise<FollowUpDraft> {
  const store = await readStore();
  const summary = getWorkspaceSummarySync(store, workspaceId);
  const person = summary.persons.find((item) => item.id === personId);

  if (!person) {
    throw new Error(`Person ${personId} not found.`);
  }

  const encounter = summary.encounters.find((item) => item.personId === personId);
  const target = summary.targets.find((item) => item.personId === personId);

  const draftContent = encounter
    ? generateFollowUpDraft({
        event: summary.event,
        person,
        encounter
      })
    : {
        subject: `Nice to connect before ${summary.event.name}, ${person.fullName.split(/\s+/)[0]}`,
        body: [
          `Hi ${person.fullName.split(/\s+/)[0]},`,
          '',
          `I noticed you in the attendee list for ${summary.event.name}.`,
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

  const draft: FollowUpDraft = {
    id: createId('draft'),
    workspaceId,
    personId,
    targetId: target?.id,
    encounterId: encounter?.id,
    subject: draftContent.subject,
    body: draftContent.body,
    summary: draftContent.summary,
    nextSteps: draftContent.nextSteps,
    status: 'GENERATED',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  store.drafts.unshift(draft);
  touchWorkspace(store, workspaceId);
  addAuditLog(store, workspaceId, 'draft.generated', 'FollowUpDraft', draft.id, {
    personId,
    encounterId: encounter?.id ?? null
  });

  await writeStore(store);
  return draft;
}

export async function syncHubSpotTaskForPerson(workspaceId: string, personId: string): Promise<Task> {
  const store = await readStore();
  const summary = getWorkspaceSummarySync(store, workspaceId);
  const person = summary.persons.find((item) => item.id === personId);

  if (!person) {
    throw new Error(`Person ${personId} not found.`);
  }

  const target = summary.targets.find((item) => item.personId === personId);
  const encounter = summary.encounters.find((item) => item.personId === personId);

  const subject = `Follow up with ${person.fullName}`;
  const body = encounter
    ? `Conference follow-up after ${summary.event.name}: ${encounter.structuredSummary}`
    : `Conference follow-up after ${summary.event.name}.`;

  const result = await createHubSpotTask({
    subject,
    body,
    dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString()
  });

  const task: Task = {
    id: createId('task'),
    workspaceId,
    personId,
    targetId: target?.id,
    title: subject,
    body,
    dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
    status: 'SYNCED',
    hubspotTaskId: result.externalId,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  store.tasks.unshift(task);
  touchWorkspace(store, workspaceId);
  addAuditLog(store, workspaceId, 'hubspot.task_synced', 'Task', task.id, {
    personId,
    mode: result.mode,
    externalId: result.externalId
  });

  await writeStore(store);
  return task;
}

export async function syncGmailDraftById(workspaceId: string, draftId: string): Promise<FollowUpDraft> {
  const store = await readStore();
  const summary = getWorkspaceSummarySync(store, workspaceId);
  const draft = summary.drafts.find((item) => item.id === draftId);

  if (!draft) {
    throw new Error(`Draft ${draftId} not found.`);
  }

  const person = summary.persons.find((item) => item.id === draft.personId);
  if (!person?.primaryEmail) {
    throw new Error('The selected person needs an email before creating a Gmail draft.');
  }

  const result = await createGmailDraft({
    to: person.primaryEmail,
    subject: draft.subject,
    body: draft.body
  });

  const persisted = store.drafts.find((item) => item.id === draftId);
  if (!persisted) {
    throw new Error(`Persisted draft ${draftId} not found.`);
  }

  persisted.gmailDraftId = result.externalId;
  persisted.status = 'SYNCED';
  persisted.updatedAt = nowIso();

  touchWorkspace(store, workspaceId);
  addAuditLog(store, workspaceId, 'gmail.draft_synced', 'FollowUpDraft', persisted.id, {
    personId: person.id,
    mode: result.mode,
    externalId: result.externalId
  });

  await writeStore(store);
  return persisted;
}

export function demoAttendeeCards() {
  return DEMO_ATTENDEES;
}

export function demoSessionCards() {
  return DEMO_SESSIONS;
}
