import { getPrismaClient, Prisma, type CopilotPrismaClient } from '@copilot/db';
import {
  DEMO_EVENT,
  DEMO_HUBSPOT_DIRECTORY,
  DEMO_WORKSPACE,
  createId,
  deterministicHubSpotMatch,
  normalizeCompanyName,
  nowIso,
  type AuditLog,
  type CaptureBatch,
  type CapturePagePayload,
  type Company,
  type Encounter,
  type Event,
  type FollowUpDraft,
  type MatchMethod,
  type Person,
  type Session,
  type SourceRecord,
  type Target,
  type TargetStatus,
  type Task,
  type Workspace
} from '@copilot/core';
import type {
  AuditLogWriteInput,
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
import { savePageHtmlArtifact } from './local-artifact-store';

type PrismaExecutor = CopilotPrismaClient | Prisma.TransactionClient;

function toIso(value: Date): string {
  return value.toISOString();
}

function toOptionalIso(value: Date | null | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

function toDate(value: string): Date {
  return new Date(value);
}

function jsonObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function companyDomainFromEmail(email?: string): string | undefined {
  return email?.split('@')[1]?.toLowerCase();
}

function personSummaryForHubSpot(person: { primaryEmail?: string; fullName: string }, company?: Company) {
  return deterministicHubSpotMatch(
    {
      primaryEmail: person.primaryEmail,
      fullName: person.fullName,
      companyName: company?.name
    },
    DEMO_HUBSPOT_DIRECTORY
  );
}

function personSourceRelationRole(capture: CapturePagePayload, fields: Record<string, unknown>) {
  return capture.pageType.startsWith('SESSION') && fields.isSpeaker === true ? 'SPEAKER_CARD' : 'LIST_ITEM';
}

function extractBatchPageTextSummary(value: Prisma.JsonValue | null | undefined): string | undefined {
  const summary = jsonObject(value).pageTextSummary;
  return typeof summary === 'string' ? summary : undefined;
}

function extractEncounterSummary(value: Prisma.JsonValue | null | undefined): {
  summary: string;
  nextSteps: string[];
  outcome?: 'MET' | 'MISSED';
  sessionId?: string;
  speakerPersonId?: string;
} {
  const payload = jsonObject(value);
  const outcome = payload.outcome;
  const sessionId = payload.sessionId;
  const speakerPersonId = payload.speakerPersonId;
  return {
    summary: typeof payload.summary === 'string' ? payload.summary : '',
    nextSteps: stringArray(payload.nextSteps),
    outcome: outcome === 'MET' || outcome === 'MISSED' ? outcome : undefined,
    sessionId: typeof sessionId === 'string' ? sessionId : undefined,
    speakerPersonId: typeof speakerPersonId === 'string' ? speakerPersonId : undefined
  };
}

function toWorkspaceModel(record: {
  id: string;
  eventId: string;
  name: string;
  ownerUserKey: string | null;
  portalProvider: Workspace['portalProvider'];
  mode: Workspace['mode'];
  createdAt: Date;
  updatedAt: Date;
}): Workspace {
  return {
    id: record.id,
    eventId: record.eventId,
    name: record.name,
    ownerUserKey: record.ownerUserKey ?? undefined,
    portalProvider: record.portalProvider,
    mode: record.mode,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt)
  };
}

function toEventModel(record: {
  id: string;
  name: string;
  venue: string | null;
  city: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  portalProvider: Event['portalProvider'];
}): Event {
  return {
    id: record.id,
    name: record.name,
    venue: record.venue ?? undefined,
    city: record.city ?? undefined,
    startsAt: toIso(record.startsAt),
    endsAt: toIso(record.endsAt),
    timezone: record.timezone,
    portalProvider: record.portalProvider
  };
}

async function touchWorkspace(prisma: PrismaExecutor, workspaceId: string): Promise<void> {
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      updatedAt: toDate(nowIso())
    }
  });
}

async function createAuditLogEntry(
  prisma: PrismaExecutor,
  input: AuditLogWriteInput,
  createdAt: string = nowIso()
): Promise<AuditLog> {
  const record = await prisma.auditLog.create({
    data: {
      id: createId('audit'),
      workspaceId: input.workspaceId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata as Prisma.InputJsonObject,
      createdAt: toDate(createdAt)
    }
  });

  return {
    id: record.id,
    workspaceId: record.workspaceId,
    action: record.action,
    entityType: record.entityType,
    entityId: record.entityId,
    metadata: jsonObject(record.metadata),
    createdAt: toIso(record.createdAt)
  };
}

async function upsertCompany(
  prisma: PrismaExecutor,
  workspaceId: string,
  companyName?: string,
  fallbackDomain?: string
): Promise<Company | undefined> {
  if (!companyName?.trim()) {
    return undefined;
  }

  const normalizedName = normalizeCompanyName(companyName);
  const existing = await prisma.company.findFirst({
    where: {
      workspaceId,
      normalizedName
    }
  });

  if (existing) {
    if (!existing.websiteDomain && fallbackDomain) {
      const updated = await prisma.company.update({
        where: { id: existing.id },
        data: {
          websiteDomain: fallbackDomain
        }
      });

      return {
        id: updated.id,
        workspaceId: updated.workspaceId,
        name: updated.name,
        normalizedName: updated.normalizedName,
        domain: updated.websiteDomain ?? undefined,
        createdAt: toIso(updated.createdAt),
        updatedAt: toIso(updated.updatedAt)
      };
    }

    return {
      id: existing.id,
      workspaceId: existing.workspaceId,
      name: existing.name,
      normalizedName: existing.normalizedName,
      domain: existing.websiteDomain ?? undefined,
      createdAt: toIso(existing.createdAt),
      updatedAt: toIso(existing.updatedAt)
    };
  }

  const created = await prisma.company.create({
    data: {
      id: createId('company'),
      workspaceId,
      name: companyName.trim(),
      normalizedName,
      websiteDomain: fallbackDomain
    }
  });

  return {
    id: created.id,
    workspaceId: created.workspaceId,
    name: created.name,
    normalizedName: created.normalizedName,
    domain: created.websiteDomain ?? undefined,
    createdAt: toIso(created.createdAt),
    updatedAt: toIso(created.updatedAt)
  };
}

async function findExistingPerson(
  prisma: PrismaExecutor,
  workspaceId: string,
  fields: Record<string, unknown>,
  companyId?: string
) {
  const email = typeof fields.email === 'string' ? fields.email.toLowerCase() : undefined;
  const fullName = typeof fields.fullName === 'string' ? fields.fullName.trim() : '';

  if (email) {
    const byEmail = await prisma.person.findFirst({
      where: {
        workspaceId,
        primaryEmail: {
          equals: email,
          mode: 'insensitive'
        }
      }
    });

    if (byEmail) {
      return byEmail;
    }
  }

  if (fullName && companyId) {
    const byNameAndCompany = await prisma.person.findFirst({
      where: {
        workspaceId,
        companyId,
        fullName: {
          equals: fullName,
          mode: 'insensitive'
        }
      }
    });

    if (byNameAndCompany) {
      return byNameAndCompany;
    }
  }

  if (!fullName) {
    return null;
  }

  return prisma.person.findFirst({
    where: {
      workspaceId,
      fullName: {
        equals: fullName,
        mode: 'insensitive'
      }
    }
  });
}

async function upsertPersonFromCapture(
  prisma: PrismaExecutor,
  workspaceId: string,
  fields: Record<string, unknown>
): Promise<{ personId: string; companyId?: string; created: boolean }> {
  const fullName = typeof fields.fullName === 'string' ? fields.fullName.trim() : 'Unknown Person';
  const title = typeof fields.title === 'string' ? fields.title : undefined;
  const email = typeof fields.email === 'string' ? fields.email.toLowerCase() : undefined;
  const companyName = typeof fields.companyName === 'string' ? fields.companyName : undefined;
  const isSpeaker = fields.isSpeaker === true;
  const isAttendee = fields.isAttendee !== false;

  const company = await upsertCompany(prisma, workspaceId, companyName, companyDomainFromEmail(email));
  const existing = await findExistingPerson(prisma, workspaceId, fields, company?.id);
  const hubSpotMatch = personSummaryForHubSpot(
    {
      primaryEmail: email,
      fullName
    },
    company
  );

  if (existing) {
    await prisma.person.update({
      where: { id: existing.id },
      data: {
        fullName: existing.fullName || fullName,
        title: existing.title ?? title,
        primaryEmail: existing.primaryEmail ?? email,
        companyId: existing.companyId ?? company?.id,
        isSpeaker: existing.isSpeaker || isSpeaker,
        isAttendee: existing.isAttendee || isAttendee,
        hubspotContactId: hubSpotMatch.hubspotContactId ?? existing.hubspotContactId,
        matchMethod: hubSpotMatch.matchMethod
      }
    });

    return {
      personId: existing.id,
      companyId: existing.companyId ?? company?.id ?? undefined,
      created: false
    };
  }

  const created = await prisma.person.create({
    data: {
      id: createId('person'),
      workspaceId,
      companyId: company?.id,
      fullName,
      title,
      primaryEmail: email,
      isAttendee,
      isSpeaker,
      hubspotContactId: hubSpotMatch.hubspotContactId,
      matchMethod: hubSpotMatch.matchMethod
    }
  });

  return {
    personId: created.id,
    companyId: created.companyId ?? undefined,
    created: true
  };
}

async function findOrCreateSpeakerPerson(
  prisma: PrismaExecutor,
  workspaceId: string,
  speakerName: string
): Promise<string> {
  const existing = await prisma.person.findFirst({
    where: {
      workspaceId,
      fullName: {
        equals: speakerName,
        mode: 'insensitive'
      }
    }
  });

  if (existing) {
    if (!existing.isSpeaker) {
      await prisma.person.update({
        where: { id: existing.id },
        data: {
          isSpeaker: true
        }
      });
    }

    return existing.id;
  }

  const created = await prisma.person.create({
    data: {
      id: createId('person'),
      workspaceId,
      fullName: speakerName,
      isAttendee: false,
      isSpeaker: true,
      matchMethod: 'NONE'
    }
  });

  return created.id;
}

async function upsertSessionFromCapture(
  prisma: PrismaExecutor,
  workspaceId: string,
  fields: Record<string, unknown>
): Promise<{ sessionId: string; created: boolean }> {
  const title = typeof fields.title === 'string' ? fields.title : 'Untitled Session';
  const startsAt = typeof fields.startsAt === 'string' ? fields.startsAt : undefined;
  const speakerNames = Array.isArray(fields.speakerNames)
    ? fields.speakerNames.filter((entry): entry is string => typeof entry === 'string')
    : [];

  const existing = await prisma.session.findFirst({
    where: {
      workspaceId,
      title,
      startAt: startsAt ? toDate(startsAt) : null
    }
  });

  const speakerPersonIds: string[] = [];
  for (const speakerName of speakerNames) {
    speakerPersonIds.push(await findOrCreateSpeakerPerson(prisma, workspaceId, speakerName));
  }

  if (existing) {
    await prisma.session.update({
      where: { id: existing.id },
      data: {
        abstract: existing.abstract ?? (typeof fields.description === 'string' ? fields.description : undefined),
        room: existing.room ?? (typeof fields.location === 'string' ? fields.location : undefined),
        endAt:
          existing.endAt ??
          (typeof fields.endsAt === 'string' ? toDate(fields.endsAt) : undefined)
      }
    });

    for (const personId of speakerPersonIds) {
      await prisma.sessionSpeaker.upsert({
        where: {
          sessionId_personId: {
            sessionId: existing.id,
            personId
          }
        },
        update: {},
        create: {
          sessionId: existing.id,
          personId
        }
      });
    }

    return {
      sessionId: existing.id,
      created: false
    };
  }

  const created = await prisma.session.create({
    data: {
      id: createId('session'),
      workspaceId,
      title,
      abstract: typeof fields.description === 'string' ? fields.description : undefined,
      room: typeof fields.location === 'string' ? fields.location : undefined,
      startAt: startsAt ? toDate(startsAt) : undefined,
      endAt: typeof fields.endsAt === 'string' ? toDate(fields.endsAt) : undefined
    }
  });

  for (const personId of speakerPersonIds) {
    await prisma.sessionSpeaker.create({
      data: {
        sessionId: created.id,
        personId
      }
    });
  }

  return {
    sessionId: created.id,
    created: true
  };
}

async function createSourceRecord(
  prisma: PrismaExecutor,
  record: SourceRecord
): Promise<void> {
  await prisma.sourceRecord.create({
    data: {
      id: record.id,
      workspaceId: record.workspaceId,
      captureBatchId: record.captureBatchId,
      entityType: record.entityType,
      externalKey: record.externalKey,
      rawFields: record.raw as Prisma.InputJsonObject,
      rawHtmlSnippet: record.rawHtmlSnippet,
      pageUrl: record.pageUrl,
      provenance: record.provenance as unknown as Prisma.InputJsonObject,
      createdAt: toDate(record.createdAt)
    }
  });

  if (record.resolvedPersonId) {
    await prisma.personSourceRecord.upsert({
      where: {
        personId_sourceRecordId: {
          personId: record.resolvedPersonId,
          sourceRecordId: record.id
        }
      },
      update: {},
      create: {
        personId: record.resolvedPersonId,
        sourceRecordId: record.id,
        relationRole: 'LIST_ITEM'
      }
    });
  }

  if (record.resolvedCompanyId) {
    await prisma.companySourceRecord.upsert({
      where: {
        companyId_sourceRecordId: {
          companyId: record.resolvedCompanyId,
          sourceRecordId: record.id
        }
      },
      update: {},
      create: {
        companyId: record.resolvedCompanyId,
        sourceRecordId: record.id,
        relationRole: 'LIST_ITEM'
      }
    });
  }

  if (record.resolvedSessionId) {
    await prisma.sessionSourceRecord.upsert({
      where: {
        sessionId_sourceRecordId: {
          sessionId: record.resolvedSessionId,
          sourceRecordId: record.id
        }
      },
      update: {},
      create: {
        sessionId: record.resolvedSessionId,
        sourceRecordId: record.id,
        relationRole: 'SESSION_CARD'
      }
    });
  }
}

export class PrismaFirstSliceRepository implements FirstSliceRepository {
  constructor(private readonly prisma: CopilotPrismaClient = getPrismaClient()) {}

  async ensureDemoWorkspace(): Promise<string> {
    const existing = await this.prisma.workspace.findUnique({
      where: {
        id: DEMO_WORKSPACE.id
      }
    });

    if (existing) {
      return existing.id;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.event.upsert({
        where: {
          id: DEMO_EVENT.id
        },
        update: {
          name: DEMO_EVENT.name,
          venue: DEMO_EVENT.venue,
          city: DEMO_EVENT.city,
          startsAt: toDate(DEMO_EVENT.startsAt),
          endsAt: toDate(DEMO_EVENT.endsAt),
          timezone: DEMO_EVENT.timezone,
          portalProvider: DEMO_EVENT.portalProvider
        },
        create: {
          id: DEMO_EVENT.id,
          name: DEMO_EVENT.name,
          venue: DEMO_EVENT.venue,
          city: DEMO_EVENT.city,
          startsAt: toDate(DEMO_EVENT.startsAt),
          endsAt: toDate(DEMO_EVENT.endsAt),
          timezone: DEMO_EVENT.timezone,
          portalProvider: DEMO_EVENT.portalProvider
        }
      });

      await tx.workspace.create({
        data: {
          id: DEMO_WORKSPACE.id,
          eventId: DEMO_WORKSPACE.eventId,
          name: DEMO_WORKSPACE.name,
          ownerUserKey: DEMO_WORKSPACE.ownerUserKey,
          portalProvider: DEMO_WORKSPACE.portalProvider,
          mode: DEMO_WORKSPACE.mode,
          createdAt: toDate(DEMO_WORKSPACE.createdAt),
          updatedAt: toDate(DEMO_WORKSPACE.updatedAt)
        }
      });

      await createAuditLogEntry(tx, {
        workspaceId: DEMO_WORKSPACE.id,
        action: 'workspace.seeded',
        entityType: 'Workspace',
        entityId: DEMO_WORKSPACE.id,
        metadata: {
          eventId: DEMO_EVENT.id
        }
      });
    });

    return DEMO_WORKSPACE.id;
  }

  async listWorkspaces(): Promise<WorkspaceListItem[]> {
    const workspaces = await this.prisma.workspace.findMany({
      include: {
        event: {
          select: {
            name: true
          }
        }
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    return workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      eventName: workspace.event.name
    }));
  }

  async getWorkspaceViewData(workspaceId: string): Promise<WorkspaceViewData> {
    const workspaceRecord = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId
      },
      include: {
        event: true
      }
    });

    if (!workspaceRecord) {
      throw new Error(`Workspace ${workspaceId} not found.`);
    }

    const [companies, persons, sessions, targets, encounters, drafts, tasks, captureBatches, auditLogs, sourceRecords] =
      await Promise.all([
        this.prisma.company.findMany({
          where: { workspaceId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
        }),
        this.prisma.person.findMany({
          where: { workspaceId },
          include: {
            sourceLinks: {
              select: {
                sourceRecordId: true
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
        }),
        this.prisma.session.findMany({
          where: { workspaceId },
          include: {
            speakers: {
              select: {
                personId: true
              },
              orderBy: {
                createdAt: 'asc'
              }
            },
            sourceLinks: {
              select: {
                sourceRecordId: true
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
        }),
        this.prisma.target.findMany({
          where: { workspaceId },
          orderBy: [{ targetedAt: 'desc' }, { id: 'desc' }]
        }),
        this.prisma.encounter.findMany({
          where: { workspaceId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
        }),
        this.prisma.followUpDraft.findMany({
          where: { workspaceId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
        }),
        this.prisma.task.findMany({
          where: { workspaceId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
        }),
        this.prisma.captureBatch.findMany({
          where: { workspaceId },
          include: {
            sourceRecords: {
              select: {
                provenance: true
              },
              orderBy: {
                createdAt: 'asc'
              },
              take: 1
            }
          },
          orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }]
        }),
        this.readAuditLogs(workspaceId),
        this.readSourceRecords(workspaceId)
      ]);

    return {
      workspace: toWorkspaceModel(workspaceRecord),
      event: toEventModel(workspaceRecord.event),
      companies: companies.map((company) => ({
        id: company.id,
        workspaceId: company.workspaceId,
        name: company.name,
        normalizedName: company.normalizedName,
        domain: company.websiteDomain ?? undefined,
        createdAt: toIso(company.createdAt),
        updatedAt: toIso(company.updatedAt)
      })),
      persons: persons.map((person) => ({
        id: person.id,
        workspaceId: person.workspaceId,
        companyId: person.companyId ?? undefined,
        fullName: person.fullName,
        title: person.title ?? undefined,
        primaryEmail: person.primaryEmail ?? undefined,
        isAttendee: person.isAttendee,
        isSpeaker: person.isSpeaker,
        hubspotContactId: person.hubspotContactId ?? undefined,
        matchMethod: person.matchMethod as MatchMethod,
        sourceRecordIds: person.sourceLinks.map((link) => link.sourceRecordId),
        createdAt: toIso(person.createdAt),
        updatedAt: toIso(person.updatedAt)
      })),
      sessions: sessions.map((session) => ({
        id: session.id,
        workspaceId: session.workspaceId,
        title: session.title,
        description: session.abstract ?? undefined,
        location: session.room ?? undefined,
        startsAt: toOptionalIso(session.startAt),
        endsAt: toOptionalIso(session.endAt),
        speakerPersonIds: session.speakers.map((speaker) => speaker.personId),
        sourceRecordIds: session.sourceLinks.map((link) => link.sourceRecordId),
        createdAt: toIso(session.createdAt),
        updatedAt: toIso(session.updatedAt)
      })),
      targets: targets.map((target) => ({
        id: target.id,
        workspaceId: target.workspaceId,
        personId: target.personId,
        priority: target.priority,
        status: target.status,
        why: [...target.why],
        createdAt: toIso(target.targetedAt),
        updatedAt: toIso(target.updatedAt),
        metAt: toOptionalIso(target.metAt),
        missedAt: toOptionalIso(target.missedAt)
      })),
      encounters: encounters.map((encounter) => {
        const structured = extractEncounterSummary(encounter.structuredSummary);
        return {
          id: encounter.id,
          workspaceId: encounter.workspaceId,
          personId: encounter.personId,
          targetId: encounter.targetId ?? undefined,
          outcome: structured.outcome,
          sessionId: structured.sessionId,
          speakerPersonId: structured.speakerPersonId,
          capturedVia: encounter.channel,
          noteText: encounter.noteText,
          structuredSummary: structured.summary || encounter.noteText,
          nextSteps: structured.nextSteps,
          tags: [...encounter.tags],
          createdAt: toIso(encounter.createdAt)
        };
      }),
      drafts: drafts.map((draft) => ({
        id: draft.id,
        workspaceId: draft.workspaceId,
        personId: draft.personId,
        targetId: draft.targetId ?? undefined,
        encounterId: draft.encounterId ?? undefined,
        subject: draft.subject,
        body: draft.body,
        summary: draft.summary ?? '',
        nextSteps: [...draft.nextSteps],
        status: draft.status === 'SYNCED' ? 'SYNCED' : 'GENERATED',
        gmailDraftId: draft.gmailDraftId ?? undefined,
        createdAt: toIso(draft.createdAt),
        updatedAt: toIso(draft.updatedAt)
      })),
      tasks: tasks.map((task) => ({
        id: task.id,
        workspaceId: task.workspaceId,
        personId: task.personId,
        targetId: task.targetId ?? undefined,
        title: task.title,
        body: task.body,
        dueAt: toIso(task.dueAt ?? task.createdAt),
        status: task.status === 'SYNCED' ? 'SYNCED' : 'OPEN',
        hubspotTaskId: task.hubspotTaskId ?? undefined,
        createdAt: toIso(task.createdAt),
        updatedAt: toIso(task.updatedAt)
      })),
      captureBatches: captureBatches.map((batch) => ({
        id: batch.id,
        workspaceId: batch.workspaceId,
        portalProvider: batch.portalProvider,
        pageType: batch.pageType,
        pageUrl: batch.pageUrl,
        pageTitle: batch.pageTitle ?? batch.pageType,
        pageTextSummary: extractBatchPageTextSummary(batch.sourceRecords[0]?.provenance),
        captureMethod: batch.captureMethod,
        pageArtifactId: batch.pageArtifactId ?? undefined,
        extractorVersion: batch.extractorVersion ?? undefined,
        capturedAt: toIso(batch.capturedAt),
        recordCount: batch.recordCount
      })),
      auditLogs,
      sourceRecords
    };
  }

  async ingestCaptureBatch(
    workspaceId: string,
    capture: CapturePagePayload
  ): Promise<IngestCaptureBatchResult> {
    const workspace = await this.prisma.workspace.findUnique({
      where: {
        id: workspaceId
      }
    });

    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found.`);
    }

    const pageArtifact = capture.pageHtml
      ? await savePageHtmlArtifact({
          workspaceId,
          content: capture.pageHtml
        })
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      if (pageArtifact) {
        await tx.artifact.create({
          data: {
            id: pageArtifact.id,
            workspaceId,
            kind: 'PAGE_HTML',
            storageKey: pageArtifact.storagePath,
            mimeType: 'text/html',
            byteSize: pageArtifact.byteSize
          }
        });
      }

      const batchId = createId('capture');
      await tx.captureBatch.create({
        data: {
          id: batchId,
          workspaceId,
          portalProvider: capture.portalProvider,
          pageType: capture.pageType,
          pageUrl: capture.pageUrl,
          pageTitle: capture.pageTitle,
          captureMethod: capture.captureMethod,
          pageArtifactId: pageArtifact?.id,
          extractorVersion: capture.extractorVersion,
          recordCount: capture.records.length,
          capturedAt: toDate(capture.capturedAt)
        }
      });

      let addedPeople = 0;
      let addedSessions = 0;

      for (const record of capture.records) {
        const sourceRecordId = createId('source');
        const provenance = {
          portalProvider: capture.portalProvider,
          captureMethod: capture.captureMethod,
          pageType: capture.pageType,
          pageUrl: capture.pageUrl,
          pageTitle: capture.pageTitle,
          capturedAt: capture.capturedAt,
          pageTextSummary: capture.pageTextSummary,
          extractorVersion: capture.extractorVersion,
          sourceArtifactId: pageArtifact?.id,
          sourceArtifactKind: pageArtifact ? 'page_html' : undefined,
          selectorHints: record.selectorHints
        };

        await tx.sourceRecord.create({
          data: {
            id: sourceRecordId,
            workspaceId,
            captureBatchId: batchId,
            entityType: record.entityType,
            externalKey: record.externalKey,
            rawFields: record.fields as Prisma.InputJsonObject,
            rawHtmlSnippet: record.rawHtmlSnippet,
            pageUrl: capture.pageUrl,
            provenance: provenance as unknown as Prisma.InputJsonObject,
            createdAt: toDate(capture.capturedAt)
          }
        });

        if (record.entityType === 'PERSON') {
          const result = await upsertPersonFromCapture(tx, workspaceId, record.fields);
          if (result.created) {
            addedPeople += 1;
          }

          await tx.personSourceRecord.upsert({
            where: {
              personId_sourceRecordId: {
                personId: result.personId,
                sourceRecordId
              }
            },
            update: {
              relationRole: personSourceRelationRole(capture, record.fields)
            },
            create: {
              personId: result.personId,
              sourceRecordId,
              relationRole: personSourceRelationRole(capture, record.fields)
            }
          });

          if (result.companyId) {
            await tx.companySourceRecord.upsert({
              where: {
                companyId_sourceRecordId: {
                  companyId: result.companyId,
                  sourceRecordId
                }
              },
              update: {},
              create: {
                companyId: result.companyId,
                sourceRecordId,
                relationRole: 'LIST_ITEM'
              }
            });
          }
        }

        if (record.entityType === 'SESSION') {
          const result = await upsertSessionFromCapture(tx, workspaceId, record.fields);
          if (result.created) {
            addedSessions += 1;
          }

          await tx.sessionSourceRecord.upsert({
            where: {
              sessionId_sourceRecordId: {
                sessionId: result.sessionId,
                sourceRecordId
              }
            },
            update: {},
            create: {
              sessionId: result.sessionId,
              sourceRecordId,
              relationRole: 'SESSION_CARD'
            }
          });
        }
      }

      await touchWorkspace(tx, workspaceId);
      await createAuditLogEntry(tx, {
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

      return {
        addedPeople,
        addedSessions,
        totalRecords: capture.records.length
      };
    });
  }

  async upsertTarget(input: UpsertTargetInput): Promise<Target> {
    const existing = await this.prisma.target.findUnique({
      where: {
        workspaceId_personId: {
          workspaceId: input.workspaceId,
          personId: input.personId
        }
      }
    });

    if (existing) {
      const updatedAt = nowIso();
      const status = existing.status === 'MISSED' ? 'TARGETED' : existing.status;

      await this.prisma.$transaction(async (tx) => {
        await tx.target.update({
          where: {
            id: existing.id
          },
          data: {
            priority: input.priority,
            status,
            updatedAt: toDate(updatedAt)
          }
        });

        await touchWorkspace(tx, input.workspaceId);
        await createAuditLogEntry(tx, {
          workspaceId: input.workspaceId,
          action: 'target.updated',
          entityType: 'Target',
          entityId: existing.id,
          metadata: {
            priority: input.priority
          }
        });
      });

      return {
        id: existing.id,
        workspaceId: existing.workspaceId,
        personId: existing.personId,
        priority: input.priority,
        status,
        why: [...existing.why],
        createdAt: toIso(existing.targetedAt),
        updatedAt,
        metAt: toOptionalIso(existing.metAt),
        missedAt: toOptionalIso(existing.missedAt)
      };
    }

    const createdAt = nowIso();
    const targetId = createId('target');

    await this.prisma.$transaction(async (tx) => {
      await tx.target.create({
        data: {
          id: targetId,
          workspaceId: input.workspaceId,
          personId: input.personId,
          priority: input.priority,
          status: 'TARGETED',
          why: input.why,
          targetedAt: toDate(createdAt),
          updatedAt: toDate(createdAt)
        }
      });

      await touchWorkspace(tx, input.workspaceId);
      await createAuditLogEntry(tx, {
        workspaceId: input.workspaceId,
        action: 'target.created',
        entityType: 'Target',
        entityId: targetId,
        metadata: {
          priority: input.priority
        }
      });
    });

    return {
      id: targetId,
      workspaceId: input.workspaceId,
      personId: input.personId,
      priority: input.priority,
      status: 'TARGETED',
      why: input.why,
      createdAt,
      updatedAt: createdAt
    };
  }

  async updateTargetStatus(
    workspaceId: string,
    personId: string,
    status: TargetStatus
  ): Promise<Target> {
    const existing = await this.prisma.target.findUnique({
      where: {
        workspaceId_personId: {
          workspaceId,
          personId
        }
      }
    });

    if (!existing) {
      throw new Error(`Target not found for person ${personId}`);
    }

    const updatedAt = nowIso();
    const metAt = status === 'MET' ? updatedAt : status === 'TARGETED' ? undefined : toOptionalIso(existing.metAt);
    const missedAt =
      status === 'MISSED' ? updatedAt : status === 'TARGETED' ? undefined : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.target.update({
        where: {
          id: existing.id
        },
        data: {
          status,
          metAt: status === 'MET' ? toDate(updatedAt) : status === 'TARGETED' ? null : existing.metAt,
          missedAt:
            status === 'MISSED' ? toDate(updatedAt) : status === 'TARGETED' ? null : null,
          updatedAt: toDate(updatedAt)
        }
      });

      await touchWorkspace(tx, workspaceId);
      await createAuditLogEntry(tx, {
        workspaceId,
        action: 'target.status_updated',
        entityType: 'Target',
        entityId: existing.id,
        metadata: {
          status
        }
      });
    });

    return {
      id: existing.id,
      workspaceId,
      personId,
      priority: existing.priority,
      status,
      why: [...existing.why],
      createdAt: toIso(existing.targetedAt),
      updatedAt,
      metAt,
      missedAt
    };
  }

  async createEncounter(input: CreateEncounterRecordInput): Promise<Encounter> {
    const encounterId = createId('encounter');
    const createdAt = nowIso();
    const outcome = input.outcome ?? (input.targetId ? 'MET' : undefined);

    await this.prisma.$transaction(async (tx) => {
      if (input.targetId && outcome) {
        const target = await tx.target.findUnique({
          where: {
            id: input.targetId
          }
        });

        if (target) {
          await tx.target.update({
            where: {
              id: target.id
            },
            data: {
              status: outcome,
              metAt: outcome === 'MET' ? toDate(createdAt) : null,
              missedAt: outcome === 'MISSED' ? toDate(createdAt) : null,
              updatedAt: toDate(createdAt)
            }
          });
        }
      }

      await tx.encounter.create({
        data: {
          id: encounterId,
          workspaceId: input.workspaceId,
          personId: input.personId,
          targetId: input.targetId,
          channel: input.capturedVia,
          noteText: input.noteText,
          structuredSummary: {
            summary: input.structuredSummary,
            nextSteps: input.nextSteps,
            ...(outcome ? { outcome } : {}),
            ...(input.sessionId ? { sessionId: input.sessionId } : {}),
            ...(input.speakerPersonId ? { speakerPersonId: input.speakerPersonId } : {})
          } as Prisma.InputJsonObject,
          tags: input.tags,
          occurredAt: toDate(createdAt),
          createdAt: toDate(createdAt)
        }
      });

      await touchWorkspace(tx, input.workspaceId);
      await createAuditLogEntry(tx, {
        workspaceId: input.workspaceId,
        action: 'encounter.logged',
        entityType: 'Encounter',
        entityId: encounterId,
        metadata: {
          personId: input.personId,
          outcome: outcome ?? null,
          sessionId: input.sessionId ?? null,
          speakerPersonId: input.speakerPersonId ?? null,
          tags: input.tags
        }
      });
    });

    return {
      id: encounterId,
      workspaceId: input.workspaceId,
      personId: input.personId,
      targetId: input.targetId,
      outcome,
      sessionId: input.sessionId,
      speakerPersonId: input.speakerPersonId,
      capturedVia: input.capturedVia,
      noteText: input.noteText,
      structuredSummary: input.structuredSummary,
      nextSteps: input.nextSteps,
      tags: input.tags,
      createdAt
    };
  }

  async saveGeneratedDraft(input: SaveGeneratedDraftInput): Promise<FollowUpDraft> {
    const draftId = createId('draft');
    const createdAt = nowIso();

    await this.prisma.$transaction(async (tx) => {
      await tx.followUpDraft.create({
        data: {
          id: draftId,
          workspaceId: input.workspaceId,
          personId: input.personId,
          targetId: input.targetId,
          encounterId: input.encounterId,
          subject: input.subject,
          body: input.body,
          summary: input.summary,
          nextSteps: input.nextSteps,
          status: 'GENERATED',
          createdAt: toDate(createdAt),
          updatedAt: toDate(createdAt)
        }
      });

      await touchWorkspace(tx, input.workspaceId);
      await createAuditLogEntry(tx, {
        workspaceId: input.workspaceId,
        action: 'draft.generated',
        entityType: 'FollowUpDraft',
        entityId: draftId,
        metadata: {
          personId: input.personId,
          encounterId: input.encounterId ?? null
        }
      });
    });

    return {
      id: draftId,
      workspaceId: input.workspaceId,
      personId: input.personId,
      targetId: input.targetId,
      encounterId: input.encounterId,
      subject: input.subject,
      body: input.body,
      summary: input.summary,
      nextSteps: input.nextSteps,
      status: 'GENERATED',
      createdAt,
      updatedAt: createdAt
    };
  }

  async saveSyncTaskResult(input: SaveSyncTaskResultInput): Promise<Task> {
    const taskId = createId('task');
    const createdAt = nowIso();

    await this.prisma.$transaction(async (tx) => {
      await tx.task.create({
        data: {
          id: taskId,
          workspaceId: input.workspaceId,
          personId: input.personId,
          targetId: input.targetId,
          title: input.title,
          body: input.body,
          dueAt: toDate(input.dueAt),
          status: 'SYNCED',
          hubspotTaskId: input.syncResult.externalId,
          syncStatus: 'SUCCESS',
          createdAt: toDate(createdAt),
          updatedAt: toDate(createdAt)
        }
      });

      await touchWorkspace(tx, input.workspaceId);
      await createAuditLogEntry(tx, {
        workspaceId: input.workspaceId,
        action: 'hubspot.task_synced',
        entityType: 'Task',
        entityId: taskId,
        metadata: {
          personId: input.personId,
          mode: input.syncResult.mode,
          externalId: input.syncResult.externalId
        }
      });
    });

    return {
      id: taskId,
      workspaceId: input.workspaceId,
      personId: input.personId,
      targetId: input.targetId,
      title: input.title,
      body: input.body,
      dueAt: input.dueAt,
      status: 'SYNCED',
      hubspotTaskId: input.syncResult.externalId,
      createdAt,
      updatedAt: createdAt
    };
  }

  async saveSyncDraftResult(input: SaveSyncDraftResultInput): Promise<FollowUpDraft> {
    const existing = await this.prisma.followUpDraft.findFirst({
      where: {
        workspaceId: input.workspaceId,
        id: input.draftId
      }
    });

    if (!existing) {
      throw new Error(`Draft ${input.draftId} not found.`);
    }

    const updatedAt = nowIso();

    await this.prisma.$transaction(async (tx) => {
      await tx.followUpDraft.update({
        where: {
          id: existing.id
        },
        data: {
          gmailDraftId: input.syncResult.externalId,
          status: 'SYNCED',
          syncStatus: 'SUCCESS',
          updatedAt: toDate(updatedAt)
        }
      });

      await touchWorkspace(tx, input.workspaceId);
      await createAuditLogEntry(tx, {
        workspaceId: input.workspaceId,
        action: 'gmail.draft_synced',
        entityType: 'FollowUpDraft',
        entityId: existing.id,
        metadata: {
          personId: existing.personId,
          mode: input.syncResult.mode,
          externalId: input.syncResult.externalId
        }
      });
    });

    return {
      id: existing.id,
      workspaceId: existing.workspaceId,
      personId: existing.personId,
      targetId: existing.targetId ?? undefined,
      encounterId: existing.encounterId ?? undefined,
      subject: existing.subject,
      body: existing.body,
      summary: existing.summary ?? '',
      nextSteps: [...existing.nextSteps],
      status: 'SYNCED',
      gmailDraftId: input.syncResult.externalId,
      createdAt: toIso(existing.createdAt),
      updatedAt
    };
  }

  async writeAuditLog(input: AuditLogWriteInput): Promise<AuditLog> {
    return createAuditLogEntry(this.prisma, input);
  }

  async readAuditLogs(workspaceId: string, options?: ReadAuditLogsOptions): Promise<AuditLog[]> {
    const limit = options?.limit ?? 20;
    const entries = await this.prisma.auditLog.findMany({
      where: {
        workspaceId
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit
    });

    return entries.map((entry) => ({
      id: entry.id,
      workspaceId: entry.workspaceId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: jsonObject(entry.metadata),
      createdAt: toIso(entry.createdAt)
    }));
  }

  async writeSourceRecords(records: SourceRecord[]): Promise<SourceRecord[]> {
    await this.prisma.$transaction(async (tx) => {
      for (const record of records) {
        await createSourceRecord(tx, record);
      }
    });

    return records;
  }

  async readSourceRecords(workspaceId: string): Promise<SourceRecord[]> {
    const records = await this.prisma.sourceRecord.findMany({
      where: {
        workspaceId
      },
      include: {
        captureBatch: {
          select: {
            pageType: true
          }
        },
        personLinks: {
          select: {
            personId: true
          }
        },
        companyLinks: {
          select: {
            companyId: true
          }
        },
        sessionLinks: {
          select: {
            sessionId: true
          }
        }
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });

    return records
      .filter(
        (
          record
        ): record is typeof record & {
          entityType: SourceRecord['entityType'];
        } => record.entityType === 'PERSON' || record.entityType === 'SESSION'
      )
      .map((record) => {
        const provenance = jsonObject(record.provenance);
        const pageType = (
          typeof provenance.pageType === 'string' ? provenance.pageType : record.captureBatch.pageType
        ) as SourceRecord['pageType'];

        return {
          id: record.id,
          workspaceId: record.workspaceId,
          captureBatchId: record.captureBatchId,
          entityType: record.entityType,
          externalKey: record.externalKey ?? undefined,
          raw: jsonObject(record.rawFields),
          pageUrl: record.pageUrl,
          pageType,
          provenance: {
            portalProvider:
              (typeof provenance.portalProvider === 'string' ? provenance.portalProvider : 'GRIP') as SourceRecord['provenance']['portalProvider'],
            captureMethod:
              (typeof provenance.captureMethod === 'string' ? provenance.captureMethod : 'DOM') as SourceRecord['provenance']['captureMethod'],
            pageType,
            pageUrl:
              typeof provenance.pageUrl === 'string' ? provenance.pageUrl : record.pageUrl,
            pageTitle:
              typeof provenance.pageTitle === 'string' ? provenance.pageTitle : pageType,
            capturedAt:
              typeof provenance.capturedAt === 'string' ? provenance.capturedAt : toIso(record.createdAt),
            pageTextSummary:
              typeof provenance.pageTextSummary === 'string' ? provenance.pageTextSummary : undefined,
            extractorVersion:
              typeof provenance.extractorVersion === 'string' ? provenance.extractorVersion : 'unknown',
            sourceArtifactId:
              typeof provenance.sourceArtifactId === 'string' ? provenance.sourceArtifactId : undefined,
            sourceArtifactKind:
              typeof provenance.sourceArtifactKind === 'string'
                ? (provenance.sourceArtifactKind as SourceRecord['provenance']['sourceArtifactKind'])
                : undefined,
            selectorHints: stringArray(provenance.selectorHints)
          },
          rawHtmlSnippet: record.rawHtmlSnippet ?? undefined,
          resolvedPersonId: record.personLinks[0]?.personId,
          resolvedCompanyId: record.companyLinks[0]?.companyId,
          resolvedSessionId: record.sessionLinks[0]?.sessionId,
          createdAt: toIso(record.createdAt)
        };
      });
  }
}

export function createPrismaFirstSliceRepository(): FirstSliceRepository {
  return new PrismaFirstSliceRepository();
}
