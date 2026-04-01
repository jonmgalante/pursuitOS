import type { Encounter, FollowUpDraft, Person, Target, Task } from '@copilot/core';
import {
  ConnectorSyncError,
  createGmailDraftClient,
  createHubSpotTaskClient,
  isConnectorSyncError,
  type ConnectorAccessToken,
  type ConnectorMode,
  type ConnectorTokenSource,
  type GmailConnectorConfig,
  type HubSpotConnectorConfig
} from '@copilot/connectors';
import type { FirstSliceRepository } from '../repositories/first-slice-repository';

const HUBSPOT_SYNC_MODE_ENV = 'HUBSPOT_SYNC_MODE';
const GMAIL_SYNC_MODE_ENV = 'GMAIL_SYNC_MODE';

export interface ConnectorTokenProvider {
  getToken(provider: 'HUBSPOT' | 'GMAIL'): Promise<ConnectorAccessToken | undefined>;
}

export interface SyncLogger {
  error(message: string, metadata: Record<string, unknown>): void;
}

export interface HubSpotTaskSyncContext {
  workspaceId: string;
  eventName: string;
  person: Person;
  target?: Target;
  encounter?: Encounter;
  companyName?: string;
}

export interface GmailDraftSyncContext {
  workspaceId: string;
  person: Person;
  draft: FollowUpDraft;
}

export interface SyncService {
  syncHubSpotTask(context: HubSpotTaskSyncContext): Promise<Task>;
  syncGmailDraft(context: GmailDraftSyncContext): Promise<FollowUpDraft>;
}

export interface CreateSyncServiceOptions {
  tokenProvider?: ConnectorTokenProvider;
  logger?: SyncLogger;
  hubspotMode?: ConnectorMode;
  gmailMode?: ConnectorMode;
}

class EnvConnectorTokenProvider implements ConnectorTokenProvider {
  async getToken(provider: 'HUBSPOT' | 'GMAIL'): Promise<ConnectorAccessToken | undefined> {
    const value =
      provider === 'HUBSPOT'
        ? process.env.HUBSPOT_ACCESS_TOKEN?.trim()
        : process.env.GMAIL_ACCESS_TOKEN?.trim();

    return value
      ? {
          value,
          source: 'env'
        }
      : undefined;
  }
}

const defaultSyncLogger: SyncLogger = {
  error(message, metadata) {
    console.error(`[sync] ${message} ${JSON.stringify(metadata)}`);
  }
};

function readConnectorMode(
  value: string | undefined,
  envName: string,
  provider: 'HUBSPOT' | 'GMAIL'
): ConnectorMode {
  const normalized = value?.trim().toLowerCase();

  if (!normalized || normalized === 'mock') {
    return 'mock';
  }

  if (normalized === 'live') {
    return 'live';
  }

  throw new ConnectorSyncError({
    provider,
    mode: 'mock',
    operation: provider === 'HUBSPOT' ? 'HUBSPOT_TASK_CREATE' : 'GMAIL_DRAFT_CREATE',
    code: 'CONFIG_INVALID',
    publicMessage: `${envName} must be set to "mock" or "live".`,
    logMessage: `Received unsupported ${envName} value "${value}".`
  });
}

async function resolveHubSpotConfig(
  mode: ConnectorMode,
  tokenProvider: ConnectorTokenProvider
): Promise<{ config: HubSpotConnectorConfig; tokenSource: ConnectorTokenSource | null }> {
  if (mode === 'mock') {
    return {
      config: {
        provider: 'HUBSPOT',
        mode: 'mock'
      },
      tokenSource: null
    };
  }

  const accessToken = await tokenProvider.getToken('HUBSPOT');

  if (!accessToken) {
    throw new ConnectorSyncError({
      provider: 'HUBSPOT',
      mode,
      operation: 'HUBSPOT_TASK_CREATE',
      code: 'ACCESS_TOKEN_MISSING',
      publicMessage: 'HubSpot live sync requires HUBSPOT_ACCESS_TOKEN.',
      logMessage: 'Live HubSpot sync was selected but no access token was available from the token provider.'
    });
  }

  return {
    config: {
      provider: 'HUBSPOT',
      mode,
      accessToken
    },
    tokenSource: accessToken.source
  };
}

async function resolveGmailConfig(
  mode: ConnectorMode,
  tokenProvider: ConnectorTokenProvider
): Promise<{ config: GmailConnectorConfig; tokenSource: ConnectorTokenSource | null }> {
  if (mode === 'mock') {
    return {
      config: {
        provider: 'GMAIL',
        mode: 'mock'
      },
      tokenSource: null
    };
  }

  const accessToken = await tokenProvider.getToken('GMAIL');

  if (!accessToken) {
    throw new ConnectorSyncError({
      provider: 'GMAIL',
      mode,
      operation: 'GMAIL_DRAFT_CREATE',
      code: 'ACCESS_TOKEN_MISSING',
      publicMessage: 'Gmail live sync requires GMAIL_ACCESS_TOKEN.',
      logMessage: 'Live Gmail sync was selected but no access token was available from the token provider.'
    });
  }

  return {
    config: {
      provider: 'GMAIL',
      mode,
      accessToken
    },
    tokenSource: accessToken.source
  };
}

function truncate(value: string, maxLength = 280): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

function redactEmail(email?: string): string | undefined {
  if (!email || !email.includes('@')) {
    return email;
  }

  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) {
    return '[redacted-email]';
  }

  return `${localPart.slice(0, 1)}***@${domain}`;
}

function redactId(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.length <= 8 ? '[redacted-id]' : `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function redactLogMessage(message?: string): string | undefined {
  if (!message) {
    return undefined;
  }

  const withoutBearerTokens = message.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
  const withRedactedEmails = withoutBearerTokens.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    (value) => redactEmail(value) ?? '[redacted-email]'
  );

  return truncate(withRedactedEmails);
}

function connectorFailureMetadata(error: unknown): {
  code: string;
  statusCode: number | null;
  message: string;
  logMessage: string | null;
} {
  if (isConnectorSyncError(error)) {
    return {
      code: error.details.code,
      statusCode: error.details.statusCode ?? null,
      message: error.details.publicMessage,
      logMessage: error.details.logMessage ?? null
    };
  }

  if (error instanceof Error) {
    return {
      code: 'UNEXPECTED_ERROR',
      statusCode: null,
      message: truncate(error.message),
      logMessage: truncate(error.stack ?? error.message)
    };
  }

  return {
    code: 'UNEXPECTED_ERROR',
    statusCode: null,
    message: 'Unexpected sync error.',
    logMessage: truncate(String(error))
  };
}

function publicSyncError(error: unknown, fallbackMessage: string): Error {
  if (isConnectorSyncError(error)) {
    return new Error(error.details.publicMessage);
  }

  return new Error(fallbackMessage);
}

class DefaultSyncService implements SyncService {
  constructor(
    private readonly repository: FirstSliceRepository,
    private readonly tokenProvider: ConnectorTokenProvider,
    private readonly logger: SyncLogger,
    private readonly options: Required<Pick<CreateSyncServiceOptions, 'hubspotMode' | 'gmailMode'>>
  ) {}

  async syncHubSpotTask(context: HubSpotTaskSyncContext): Promise<Task> {
    const mode = this.options.hubspotMode;
    const title = `Follow up with ${context.person.fullName}`;
    const body = context.encounter
      ? `Conference follow-up after ${context.eventName}: ${context.encounter.structuredSummary}`
      : `Conference follow-up after ${context.eventName}.`;
    const dueAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString();

    await this.repository.writeAuditLog({
      workspaceId: context.workspaceId,
      action: 'hubspot.task_sync_attempted',
      entityType: 'Person',
      entityId: context.person.id,
      metadata: {
        personId: context.person.id,
        targetId: context.target?.id ?? null,
        mode,
        matchedContactId: context.person.hubspotContactId ?? null,
        matchMethod: context.person.matchMethod,
        usedMatchedContact: Boolean(context.person.hubspotContactId),
        hasEncounter: Boolean(context.encounter)
      }
    });

    let tokenSource: ConnectorTokenSource | null = null;
    let result: Awaited<ReturnType<ReturnType<typeof createHubSpotTaskClient>['createTask']>>;

    try {
      const resolved = await resolveHubSpotConfig(mode, this.tokenProvider);
      tokenSource = resolved.tokenSource;
      result = await createHubSpotTaskClient(resolved.config).createTask({
        subject: title,
        body,
        dueAt,
        contact: {
          fullName: context.person.fullName,
          hubspotContactId: context.person.hubspotContactId,
          matchMethod: context.person.matchMethod,
          primaryEmail: context.person.primaryEmail,
          companyName: context.companyName
        }
      });
    } catch (error) {
      const failure = connectorFailureMetadata(error);

      await this.repository.writeAuditLog({
        workspaceId: context.workspaceId,
        action: 'hubspot.task_sync_failed',
        entityType: 'Person',
        entityId: context.person.id,
        metadata: {
          personId: context.person.id,
          targetId: context.target?.id ?? null,
          mode,
          matchedContactId: context.person.hubspotContactId ?? null,
          matchMethod: context.person.matchMethod,
          usedMatchedContact: Boolean(context.person.hubspotContactId),
          tokenSource,
          code: failure.code,
          statusCode: failure.statusCode,
          message: failure.message
        }
      });

      this.logger.error('HubSpot task sync failed', {
        workspaceId: context.workspaceId,
        personId: context.person.id,
        targetId: context.target?.id ?? null,
        mode,
        matchedContactId: redactId(context.person.hubspotContactId),
        primaryEmail: redactEmail(context.person.primaryEmail),
        code: failure.code,
        statusCode: failure.statusCode,
        message: redactLogMessage(failure.message),
        logMessage: redactLogMessage(failure.logMessage ?? undefined)
      });

      throw publicSyncError(error, 'HubSpot task sync failed. Check server logs for details.');
    }

    return this.repository.saveSyncTaskResult({
      workspaceId: context.workspaceId,
      personId: context.person.id,
      targetId: context.target?.id,
      title,
      body,
      dueAt,
      syncResult: {
        mode: result.mode,
        externalId: result.externalId
      },
      auditMetadata: {
        matchedContactId: context.person.hubspotContactId ?? null,
        linkedContactId: result.linkedContactId ?? null,
        matchMethod: context.person.matchMethod,
        usedMatchedContact: Boolean(result.linkedContactId),
        tokenSource
      }
    });
  }

  async syncGmailDraft(context: GmailDraftSyncContext): Promise<FollowUpDraft> {
    const mode = this.options.gmailMode;

    await this.repository.writeAuditLog({
      workspaceId: context.workspaceId,
      action: 'gmail.draft_sync_attempted',
      entityType: 'FollowUpDraft',
      entityId: context.draft.id,
      metadata: {
        draftId: context.draft.id,
        personId: context.person.id,
        mode,
        draftOnly: true
      }
    });

    let tokenSource: ConnectorTokenSource | null = null;
    let result: Awaited<ReturnType<ReturnType<typeof createGmailDraftClient>['createDraft']>>;

    try {
      const resolved = await resolveGmailConfig(mode, this.tokenProvider);
      tokenSource = resolved.tokenSource;
      result = await createGmailDraftClient(resolved.config).createDraft({
        to: context.person.primaryEmail ?? '',
        subject: context.draft.subject,
        body: context.draft.body
      });
    } catch (error) {
      const failure = connectorFailureMetadata(error);

      await this.repository.writeAuditLog({
        workspaceId: context.workspaceId,
        action: 'gmail.draft_sync_failed',
        entityType: 'FollowUpDraft',
        entityId: context.draft.id,
        metadata: {
          draftId: context.draft.id,
          personId: context.person.id,
          mode,
          draftOnly: true,
          tokenSource,
          code: failure.code,
          statusCode: failure.statusCode,
          message: failure.message
        }
      });

      this.logger.error('Gmail draft sync failed', {
        workspaceId: context.workspaceId,
        draftId: context.draft.id,
        personId: context.person.id,
        mode,
        to: redactEmail(context.person.primaryEmail),
        code: failure.code,
        statusCode: failure.statusCode,
        message: redactLogMessage(failure.message),
        logMessage: redactLogMessage(failure.logMessage ?? undefined)
      });

      throw publicSyncError(error, 'Gmail draft sync failed. Check server logs for details.');
    }

    return this.repository.saveSyncDraftResult({
      workspaceId: context.workspaceId,
      draftId: context.draft.id,
      syncResult: {
        mode: result.mode,
        externalId: result.externalId
      },
      auditMetadata: {
        draftOnly: result.draftCreated,
        tokenSource
      }
    });
  }
}

export function createSyncService(
  repository: FirstSliceRepository,
  options: CreateSyncServiceOptions = {}
): SyncService {
  return new DefaultSyncService(
    repository,
    options.tokenProvider ?? new EnvConnectorTokenProvider(),
    options.logger ?? defaultSyncLogger,
    {
      hubspotMode:
        options.hubspotMode ??
        readConnectorMode(process.env.HUBSPOT_SYNC_MODE, HUBSPOT_SYNC_MODE_ENV, 'HUBSPOT'),
      gmailMode:
        options.gmailMode ??
        readConnectorMode(process.env.GMAIL_SYNC_MODE, GMAIL_SYNC_MODE_ENV, 'GMAIL')
    }
  );
}
