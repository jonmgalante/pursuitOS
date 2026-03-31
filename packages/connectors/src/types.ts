export interface HubSpotTaskInput {
  subject: string;
  body: string;
  dueAt: string;
}

export interface GmailDraftInput {
  to: string;
  subject: string;
  body: string;
}

export interface ConnectorResult {
  provider: 'HUBSPOT' | 'GMAIL';
  mode: 'mock' | 'live';
  externalId: string;
}
