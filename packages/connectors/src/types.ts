import type { MatchMethod } from '@copilot/core';

export type ConnectorProvider = 'HUBSPOT' | 'GMAIL';
export type ConnectorMode = 'mock' | 'live';
export type ConnectorTokenSource = 'env' | 'stub';
export type ConnectorOperation = 'HUBSPOT_TASK_CREATE' | 'GMAIL_DRAFT_CREATE';
export type ConnectorErrorCode =
  | 'ACCESS_TOKEN_MISSING'
  | 'CONFIG_INVALID'
  | 'HTTP_ERROR'
  | 'INVALID_RESPONSE';

export interface ConnectorAccessToken {
  value: string;
  source: ConnectorTokenSource;
}

export interface HubSpotMatchedContactMetadata {
  fullName: string;
  hubspotContactId?: string;
  matchMethod?: MatchMethod;
  primaryEmail?: string;
  companyName?: string;
}

export interface HubSpotTaskInput {
  subject: string;
  body: string;
  dueAt: string;
  contact?: HubSpotMatchedContactMetadata;
}

export interface GmailDraftInput {
  to: string;
  subject: string;
  body: string;
}

export interface ConnectorResult {
  provider: ConnectorProvider;
  mode: ConnectorMode;
  externalId: string;
}

export interface HubSpotTaskResult extends ConnectorResult {
  provider: 'HUBSPOT';
  linkedContactId?: string;
}

export interface GmailDraftResult extends ConnectorResult {
  provider: 'GMAIL';
  draftCreated: true;
}

export type HubSpotConnectorConfig =
  | {
      provider: 'HUBSPOT';
      mode: 'mock';
    }
  | {
      provider: 'HUBSPOT';
      mode: 'live';
      accessToken: ConnectorAccessToken;
      apiBaseUrl?: string;
    };

export type GmailConnectorConfig =
  | {
      provider: 'GMAIL';
      mode: 'mock';
    }
  | {
      provider: 'GMAIL';
      mode: 'live';
      accessToken: ConnectorAccessToken;
      apiBaseUrl?: string;
    };

export interface HubSpotTaskClient {
  createTask(input: HubSpotTaskInput): Promise<HubSpotTaskResult>;
}

export interface GmailDraftClient {
  createDraft(input: GmailDraftInput): Promise<GmailDraftResult>;
}

export interface ConnectorSyncErrorDetails {
  provider: ConnectorProvider;
  mode: ConnectorMode;
  operation: ConnectorOperation;
  code: ConnectorErrorCode;
  publicMessage: string;
  statusCode?: number;
  logMessage?: string;
}

export class ConnectorSyncError extends Error {
  constructor(readonly details: ConnectorSyncErrorDetails) {
    super(details.publicMessage);
    this.name = 'ConnectorSyncError';
  }
}

export function isConnectorSyncError(error: unknown): error is ConnectorSyncError {
  return error instanceof ConnectorSyncError;
}
