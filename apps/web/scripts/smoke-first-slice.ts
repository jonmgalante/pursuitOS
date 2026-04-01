import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEMO_WORKSPACE, createExtensionCaptureRequest, parseExtensionCaptureResponse } from '@copilot/core';
import { extractGripVisiblePage } from '@copilot/portal-grip';
import {
  createDemoGripAttendeeListDocument,
  createDemoGripSessionListDocument,
  installComputedStyleMock
} from './smoke/grip-demo-documents';

class SmokeAssertionError extends Error {
  constructor(
    message: string,
    readonly hint: string
  ) {
    super(message);
    this.name = 'SmokeAssertionError';
  }
}

function fail(message: string, hint: string): never {
  throw new SmokeAssertionError(message, hint);
}

function expect(condition: unknown, message: string, hint: string): asserts condition {
  if (!condition) {
    fail(message, hint);
  }
}

function logStep(message: string): void {
  console.log(`- ${message}`);
}

function logSuccess(message: string): void {
  console.log(`  ok: ${message}`);
}

async function resetDir(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
  await fs.mkdir(dirPath, { recursive: true });
}

function restoreEnvVar(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function createFormRequest(
  url: string,
  fields: Record<string, string | string[]>
): Request {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        formData.append(key, entry);
      }
      continue;
    }

    formData.set(key, value);
  }

  return new Request(url, {
    method: 'POST',
    body: formData
  });
}

function expectRedirect(response: Response, expectedPath: string, hint: string): void {
  const location = response.headers.get('location');
  expect(response.status >= 300 && response.status < 400, `Expected redirect, got HTTP ${response.status}.`, hint);
  expect(Boolean(location?.endsWith(expectedPath)), `Expected redirect to ${expectedPath}, got ${location ?? 'none'}.`, hint);
}

function personIdByName(
  persons: Array<{ id: string; fullName: string }>,
  fullName: string
): string {
  const person = persons.find((item) => item.fullName === fullName);
  expect(
    person,
    `Captured workspace is missing ${fullName}.`,
    `Check demo Grip fixture data and the capture dedupe path before target creation for ${fullName}.`
  );
  return person.id;
}

function generationMetadataFromAudit(entry: { metadata: Record<string, unknown> }): Record<string, unknown> | undefined {
  const value = entry.metadata.generation;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

async function main(): Promise<void> {
  const smokeRoot = path.join(os.tmpdir(), 'conference-rep-copilot-first-slice-smoke');
  const fileStoreDir = path.join(smokeRoot, 'data');
  const artifactsDir = path.join(smokeRoot, 'artifacts');
  const workspaceId = DEMO_WORKSPACE.id;
  const originalOpenAIApiKey = process.env.OPENAI_API_KEY;
  const originalHubSpotSyncMode = process.env.HUBSPOT_SYNC_MODE;
  const originalHubSpotAccessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  const originalGmailSyncMode = process.env.GMAIL_SYNC_MODE;
  const originalGmailAccessToken = process.env.GMAIL_ACCESS_TOKEN;

  await resetDir(smokeRoot);
  process.env.COPILOT_FILE_STORE_DIR = fileStoreDir;
  process.env.COPILOT_ARTIFACTS_DIR = artifactsDir;
  delete process.env.OPENAI_API_KEY;
  delete process.env.HUBSPOT_SYNC_MODE;
  delete process.env.HUBSPOT_ACCESS_TOKEN;
  delete process.env.GMAIL_SYNC_MODE;
  delete process.env.GMAIL_ACCESS_TOKEN;

  const restoreComputedStyle = installComputedStyleMock();

  try {
    const [
      demoSeedRoute,
      captureRoute,
      targetsRoute,
      encountersRoute,
      draftsRoute,
      hubspotRoute,
      gmailRoute,
      repositoryModule
    ] = await Promise.all([
      import('../app/api/demo/seed/route'),
      import('../app/api/capture/route'),
      import('../app/api/targets/route'),
      import('../app/api/encounters/route'),
      import('../app/api/drafts/generate/route'),
      import('../app/api/sync/hubspot/task/route'),
      import('../app/api/sync/gmail/draft/route'),
      import('../lib/repositories/file-first-slice-repository')
    ]);

    const repository = repositoryModule.createFileFirstSliceRepository();
    const refreshWorkspace = async () => repository.getWorkspaceViewData(workspaceId);

    console.log('First-slice smoke harness');
    console.log(`Mode: file-backed store, deterministic AI fallback, mock HubSpot/Gmail connectors`);
    console.log(`Isolated storage: ${smokeRoot}`);

    logStep('Seed the demo workspace through the current route');
    {
      const response = await demoSeedRoute.POST(
        new Request('http://smoke.local/api/demo/seed', { method: 'POST' })
      );
      expectRedirect(
        response,
        `/workspaces/${workspaceId}`,
        'Check /api/demo/seed or ensureDemoWorkspace if the workspace cannot be created.'
      );

      const workspace = await refreshWorkspace();
      expect(
        workspace.workspace.id === workspaceId,
        `Expected workspace ${workspaceId}, got ${workspace.workspace.id}.`,
        'Check file-backed workspace seeding in the repository path.'
      );
      logSuccess(`seeded ${workspaceId}`);
    }

    logStep('Capture the demo attendee page through /api/capture');
    {
      const attendeeCapture = extractGripVisiblePage(createDemoGripAttendeeListDocument(), {
        pageUrl: 'http://smoke.local/demo/grip/attendees',
        capturedAt: '2026-03-31T12:00:00.000Z'
      });
      expect(
        attendeeCapture.pageType === 'ATTENDEE_LIST',
        `Expected attendee page type ATTENDEE_LIST, got ${attendeeCapture.pageType}.`,
        'Check Grip page-type detection for the attendee list demo page.'
      );
      expect(
        attendeeCapture.records.length === 10,
        `Expected 10 attendee records, got ${attendeeCapture.records.length}.`,
        'Check attendee fixture visibility or attendee extraction selectors.'
      );

      const response = await captureRoute.POST(
        new Request('http://smoke.local/api/capture', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(createExtensionCaptureRequest(workspaceId, attendeeCapture))
        })
      );
      const parsed = parseExtensionCaptureResponse(await response.json());

      if (!parsed.ok) {
        fail(parsed.error, parsed.issues?.join(' ') ?? 'Check the capture route request validation.');
      }
      expect(
        parsed.summary.totalRecords === 10,
        `Expected attendee capture summary totalRecords=10, got ${parsed.summary.totalRecords}.`,
        'Check the attendee capture response summary or the repository ingest result.'
      );
      logSuccess(`${parsed.summary.totalRecords} records captured from attendees`);
    }

    logStep('Capture the demo session page through /api/capture');
    {
      const sessionCapture = extractGripVisiblePage(createDemoGripSessionListDocument(), {
        pageUrl: 'http://smoke.local/demo/grip/sessions',
        capturedAt: '2026-03-31T12:05:00.000Z'
      });
      expect(
        sessionCapture.pageType === 'SESSION_LIST',
        `Expected session page type SESSION_LIST, got ${sessionCapture.pageType}.`,
        'Check Grip page-type detection for the session list demo page.'
      );
      expect(
        sessionCapture.records.length === 15,
        `Expected 15 session + speaker records, got ${sessionCapture.records.length}.`,
        'Check session fixture visibility or session/speaker extraction selectors.'
      );

      const response = await captureRoute.POST(
        new Request('http://smoke.local/api/capture', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(createExtensionCaptureRequest(workspaceId, sessionCapture))
        })
      );
      const parsed = parseExtensionCaptureResponse(await response.json());

      if (!parsed.ok) {
        fail(parsed.error, parsed.issues?.join(' ') ?? 'Check the capture route request validation.');
      }
      expect(
        parsed.summary.totalRecords === 15,
        `Expected session capture summary totalRecords=15, got ${parsed.summary.totalRecords}.`,
        'Check the session capture response summary or the repository ingest result.'
      );
      logSuccess(`${parsed.summary.totalRecords} records captured from sessions and speakers`);
    }

    const firstWorkspace = await refreshWorkspace();

    logStep('Verify the capture floor, provenance links, and artifacts');
    {
      const totalSourceRecords = firstWorkspace.sourceRecords.length;
      const personSourceRecords = firstWorkspace.sourceRecords.filter((record) => record.entityType === 'PERSON').length;
      const sessionSourceRecords = firstWorkspace.sourceRecords.filter((record) => record.entityType === 'SESSION').length;

      expect(
        totalSourceRecords >= 25,
        `Expected at least 25 captured source records, got ${totalSourceRecords}.`,
        'Check the combined attendee/session demo fixtures or the repository ingest path.'
      );
      expect(
        personSourceRecords >= 20 && sessionSourceRecords >= 5,
        `Expected at least 20 person source records and 5 session source records, got ${personSourceRecords} person and ${sessionSourceRecords} session.`,
        'Check that attendee, speaker, and session records are all being written as source records.'
      );
      expect(
        firstWorkspace.captureBatches.length === 2,
        `Expected 2 capture batches, got ${firstWorkspace.captureBatches.length}.`,
        'Check the capture batch write path after ingest.'
      );
      expect(
        firstWorkspace.captureBatches.every((batch) => Boolean(batch.pageArtifactId)),
        'Expected every capture batch to have a page artifact id.',
        'Check page HTML artifact saving in the file-backed repository.'
      );
      expect(
        firstWorkspace.sourceRecords.every((record) => Boolean(record.provenance.sourceArtifactId)),
        'Expected every source record to retain a source artifact id in provenance.',
        'Check provenance writes during capture ingest.'
      );
      logSuccess(`${totalSourceRecords} source records with page-level provenance`);
    }

    const averyId = personIdByName(firstWorkspace.persons, 'Avery Chen');
    const jordanId = personIdByName(firstWorkspace.persons, 'Jordan Kim');
    const priyaId = personIdByName(firstWorkspace.persons, 'Priya Patel');

    logStep('Mark three people as targets through /api/targets');
    {
      const targetCases = [
        { personId: averyId, priority: 'MUST_MEET' },
        { personId: jordanId, priority: 'NICE_TO_MEET' },
        { personId: priyaId, priority: 'BACKUP' }
      ] as const;

      for (const targetCase of targetCases) {
        const response = await targetsRoute.POST(
          createFormRequest('http://smoke.local/api/targets', {
            workspaceId,
            personId: targetCase.personId,
            priority: targetCase.priority,
            redirectTo: `/workspaces/${workspaceId}`
          })
        );
        expectRedirect(
          response,
          `/workspaces/${workspaceId}`,
          'Check /api/targets or the target service path if target creation fails.'
        );
      }

      const workspace = await refreshWorkspace();
      expect(
        workspace.targets.length === 3,
        `Expected 3 targets, got ${workspace.targets.length}.`,
        'Check target upsert behavior in the repository/service path.'
      );
      logSuccess('3 targets created');
    }

    logStep('Log one encounter through /api/encounters');
    {
      const response = await encountersRoute.POST(
        createFormRequest('http://smoke.local/api/encounters', {
          workspaceId,
          personId: averyId,
          noteText:
            'Met at the booth after the session. Avery asked for a demo and pricing follow-up next week.',
          capturedVia: 'MANUAL',
          tags: ['booth', 'pricing'],
          redirectTo: `/workspaces/${workspaceId}`
        })
      );
      expectRedirect(
        response,
        `/workspaces/${workspaceId}`,
        'Check /api/encounters or the encounter service path if encounter logging fails.'
      );

      const workspace = await refreshWorkspace();
      const encounter = workspace.encounters.find((item) => item.personId === averyId);
      const target = workspace.targets.find((item) => item.personId === averyId);

      expect(
        encounter,
        'Expected one encounter for Avery Chen after the encounter route call.',
        'Check encounter persistence in the current route/service path.'
      );
      expect(
        target?.status === 'MET',
        `Expected Avery Chen to move to MET after the encounter, got ${target?.status ?? 'missing target'}.`,
        'Check target auto-status updates inside createEncounter.'
      );
      logSuccess(`encounter ${encounter.id} logged and target moved to MET`);
    }

    logStep('Set one target to missed through /api/targets');
    {
      const response = await targetsRoute.POST(
        createFormRequest('http://smoke.local/api/targets', {
          workspaceId,
          personId: jordanId,
          intent: 'status',
          status: 'MISSED',
          redirectTo: `/workspaces/${workspaceId}`
        })
      );
      expectRedirect(
        response,
        `/workspaces/${workspaceId}`,
        'Check /api/targets status updates if the MISSED flow regresses.'
      );

      const workspace = await refreshWorkspace();
      const target = workspace.targets.find((item) => item.personId === jordanId);
      expect(
        target?.status === 'MISSED',
        `Expected Jordan Kim to move to MISSED, got ${target?.status ?? 'missing target'}.`,
        'Check target status updates in the repository/service path.'
      );
      logSuccess('Jordan Kim moved to MISSED');
    }

    logStep('Generate one follow-up draft through /api/drafts/generate');
    {
      const response = await draftsRoute.POST(
        createFormRequest('http://smoke.local/api/drafts/generate', {
          workspaceId,
          personId: averyId,
          redirectTo: `/workspaces/${workspaceId}`
        })
      );
      expectRedirect(
        response,
        `/workspaces/${workspaceId}`,
        'Check /api/drafts/generate or the draft generation service path if draft creation fails.'
      );

      const workspace = await refreshWorkspace();
      const draft = workspace.drafts.find((item) => item.personId === averyId);

      expect(
        draft,
        'Expected a follow-up draft for Avery Chen after the draft route call.',
        'Check draft generation persistence in the current non-live path.'
      );
      expect(
        draft.status === 'GENERATED',
        `Expected the new draft to be GENERATED before sync, got ${draft.status}.`,
        'Check draft status writes before Gmail sync.'
      );
      logSuccess(`draft ${draft.id} generated`);
    }

    logStep('Create one mock HubSpot task through /api/sync/hubspot/task');
    {
      const response = await hubspotRoute.POST(
        createFormRequest('http://smoke.local/api/sync/hubspot/task', {
          workspaceId,
          personId: averyId,
          redirectTo: `/workspaces/${workspaceId}`
        })
      );
      expectRedirect(
        response,
        `/workspaces/${workspaceId}`,
        'Check /api/sync/hubspot/task or the HubSpot sync path if mock task creation fails.'
      );

      const workspace = await refreshWorkspace();
      const task = workspace.tasks.find((item) => item.personId === averyId);

      expect(
        task?.hubspotTaskId?.startsWith('mock_hs_task_'),
        `Expected a mock HubSpot task id, got ${task?.hubspotTaskId ?? 'none'}.`,
        'Check mock HubSpot connector selection or sync result persistence.'
      );
      expect(task, 'Expected a synced task for Avery Chen after the HubSpot route call.', 'Check task persistence after HubSpot sync.');
      logSuccess(`mock HubSpot task ${task.hubspotTaskId}`);
    }

    logStep('Create one mock Gmail draft through /api/sync/gmail/draft');
    {
      const workspaceBeforeSync = await refreshWorkspace();
      const draft = workspaceBeforeSync.drafts.find((item) => item.personId === averyId);
      expect(
        draft,
        'Expected a generated draft before running the Gmail sync step.',
        'Check draft generation before running Gmail sync.'
      );

      const response = await gmailRoute.POST(
        createFormRequest('http://smoke.local/api/sync/gmail/draft', {
          workspaceId,
          draftId: draft.id,
          redirectTo: `/workspaces/${workspaceId}`
        })
      );
      expectRedirect(
        response,
        `/workspaces/${workspaceId}`,
        'Check /api/sync/gmail/draft or the Gmail sync path if mock draft creation fails.'
      );

      const workspace = await refreshWorkspace();
      const syncedDraft = workspace.drafts.find((item) => item.id === draft.id);

      expect(
        syncedDraft?.gmailDraftId?.startsWith('mock_gmail_draft_'),
        `Expected a mock Gmail draft id, got ${syncedDraft?.gmailDraftId ?? 'none'}.`,
        'Check mock Gmail connector selection or sync result persistence.'
      );
      expect(
        syncedDraft,
        'Expected the previously generated draft to still exist after Gmail sync.',
        'Check draft persistence after Gmail sync.'
      );
      expect(
        syncedDraft.status === 'SYNCED',
        `Expected the Gmail-synced draft status to be SYNCED, got ${syncedDraft.status}.`,
        'Check draft status updates after Gmail sync.'
      );
      logSuccess(`mock Gmail draft ${syncedDraft.gmailDraftId}`);
    }

    logStep('Verify met vs missed separation and audit coverage');
    {
      const workspace = await refreshWorkspace();
      const targetStatuses = workspace.targets.reduce<Record<string, number>>((counts, target) => {
        counts[target.status] = (counts[target.status] ?? 0) + 1;
        return counts;
      }, {});
      const captureAuditLogs = workspace.auditLogs.filter((entry) => entry.action === 'capture.ingested');
      const encounterAuditLogs = workspace.auditLogs.filter((entry) => entry.action === 'encounter.logged');
      const draftAuditLogs = workspace.auditLogs.filter((entry) => entry.action === 'draft.generated');
      const hubspotAttemptAuditLogs = workspace.auditLogs.filter(
        (entry) => entry.action === 'hubspot.task_sync_attempted'
      );
      const hubspotAuditLogs = workspace.auditLogs.filter((entry) => entry.action === 'hubspot.task_synced');
      const gmailAttemptAuditLogs = workspace.auditLogs.filter(
        (entry) => entry.action === 'gmail.draft_sync_attempted'
      );
      const gmailAuditLogs = workspace.auditLogs.filter((entry) => entry.action === 'gmail.draft_synced');

      expect(
        targetStatuses.MET === 1 && targetStatuses.MISSED === 1 && targetStatuses.TARGETED === 1,
        `Expected target statuses MET=1, MISSED=1, TARGETED=1, got ${JSON.stringify(targetStatuses)}.`,
        'Check target status transitions for encounter logging or manual missed updates.'
      );
      expect(
        captureAuditLogs.length >= 2,
        `Expected at least 2 capture audit logs, got ${captureAuditLogs.length}.`,
        'Check audit log writes for capture ingest.'
      );
      expect(
        encounterAuditLogs.some((entry) => {
          const metadata = generationMetadataFromAudit(entry);
          return (
            metadata?.mode === 'fallback' &&
            metadata.fallbackReason === 'OPENAI_API_KEY_MISSING'
          );
        }),
        'Expected encounter logging to record deterministic fallback generation metadata.',
        'Check encounter note structuring fallback metadata when OPENAI_API_KEY is missing.'
      );
      expect(
        draftAuditLogs.some((entry) => {
          const metadata = generationMetadataFromAudit(entry);
          return (
            metadata?.mode === 'fallback' &&
            metadata.fallbackReason === 'OPENAI_API_KEY_MISSING'
          );
        }),
        'Expected draft generation to record deterministic fallback generation metadata.',
        'Check follow-up draft fallback metadata when OPENAI_API_KEY is missing.'
      );
      expect(
        hubspotAttemptAuditLogs.some((entry) => entry.metadata.mode === 'mock'),
        'Expected a mock HubSpot sync attempt audit log entry.',
        'Check HubSpot sync attempt audit logging before provider execution.'
      );
      expect(
        hubspotAuditLogs.some((entry) => entry.metadata.mode === 'mock'),
        'Expected a mock HubSpot sync audit log entry.',
        'Check HubSpot sync audit logging and mock/live mode handling.'
      );
      expect(
        gmailAttemptAuditLogs.some((entry) => entry.metadata.mode === 'mock'),
        'Expected a mock Gmail sync attempt audit log entry.',
        'Check Gmail sync attempt audit logging before provider execution.'
      );
      expect(
        gmailAuditLogs.some((entry) => entry.metadata.mode === 'mock'),
        'Expected a mock Gmail sync audit log entry.',
        'Check Gmail sync audit logging and mock/live mode handling.'
      );
      logSuccess(
        `targets MET=${targetStatuses.MET ?? 0}, MISSED=${targetStatuses.MISSED ?? 0}, TARGETED=${targetStatuses.TARGETED ?? 0}; capture logs=${captureAuditLogs.length}; sync logs=${hubspotAuditLogs.length + gmailAuditLogs.length}`
      );
    }

    console.log('Smoke harness passed.');
  } finally {
    restoreComputedStyle();
    restoreEnvVar('OPENAI_API_KEY', originalOpenAIApiKey);
    restoreEnvVar('HUBSPOT_SYNC_MODE', originalHubSpotSyncMode);
    restoreEnvVar('HUBSPOT_ACCESS_TOKEN', originalHubSpotAccessToken);
    restoreEnvVar('GMAIL_SYNC_MODE', originalGmailSyncMode);
    restoreEnvVar('GMAIL_ACCESS_TOKEN', originalGmailAccessToken);
  }
}

main().catch((error: unknown) => {
  if (error instanceof SmokeAssertionError) {
    console.error('Smoke harness failed.');
    console.error(`Reason: ${error.message}`);
    console.error(`Hint: ${error.hint}`);
    process.exitCode = 1;
    return;
  }

  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error('Smoke harness failed with an unexpected error.');
  console.error(message);
  process.exitCode = 1;
});
