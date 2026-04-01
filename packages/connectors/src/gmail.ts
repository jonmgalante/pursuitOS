import {
  ConnectorSyncError,
  type GmailConnectorConfig,
  type GmailDraftClient,
  type GmailDraftInput,
  type GmailDraftResult
} from './types';

const GMAIL_API_BASE_URL = 'https://gmail.googleapis.com';
const GMAIL_DRAFTS_PATH = '/gmail/v1/users/me/drafts';

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildMimeMessage(input: GmailDraftInput): string {
  const headers = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0'
  ];

  return `${headers.join('\r\n')}\r\n\r\n${input.body}`;
}

function connectorUrl(baseUrl: string | undefined, path: string): string {
  const normalizedBaseUrl = (baseUrl ?? GMAIL_API_BASE_URL).replace(/\/+$/, '');
  return `${normalizedBaseUrl}${path}`;
}

function truncate(value: string, maxLength = 280): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

async function responseText(response: Response): Promise<string | undefined> {
  const text = (await response.text()).trim();
  return text ? truncate(text) : undefined;
}

function createMockGmailDraftClient(): GmailDraftClient {
  return {
    async createDraft(): Promise<GmailDraftResult> {
      return {
        provider: 'GMAIL',
        mode: 'mock',
        externalId: `mock_gmail_draft_${Date.now()}`,
        draftCreated: true
      };
    }
  };
}

function createLiveGmailDraftClient(config: Extract<GmailConnectorConfig, { mode: 'live' }>): GmailDraftClient {
  return {
    async createDraft(input: GmailDraftInput): Promise<GmailDraftResult> {
      const raw = base64UrlEncode(buildMimeMessage(input));

      // Draft-only flow: this client only calls users.me.drafts.create and never send.
      const response = await fetch(connectorUrl(config.apiBaseUrl, GMAIL_DRAFTS_PATH), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken.value}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            raw
          }
        })
      });

      if (!response.ok) {
        throw new ConnectorSyncError({
          provider: 'GMAIL',
          mode: 'live',
          operation: 'GMAIL_DRAFT_CREATE',
          code: 'HTTP_ERROR',
          publicMessage: `Gmail draft creation failed with HTTP ${response.status}.`,
          statusCode: response.status,
          logMessage: await responseText(response)
        });
      }

      const data = (await response.json()) as { id?: unknown };

      if (typeof data.id !== 'string' || !data.id.trim()) {
        throw new ConnectorSyncError({
          provider: 'GMAIL',
          mode: 'live',
          operation: 'GMAIL_DRAFT_CREATE',
          code: 'INVALID_RESPONSE',
          publicMessage: 'Gmail draft creation returned an invalid response.',
          logMessage: 'Response JSON did not include a string id.'
        });
      }

      return {
        provider: 'GMAIL',
        mode: 'live',
        externalId: data.id,
        draftCreated: true
      };
    }
  };
}

export function createGmailDraftClient(config: GmailConnectorConfig): GmailDraftClient {
  return config.mode === 'mock' ? createMockGmailDraftClient() : createLiveGmailDraftClient(config);
}

export async function createGmailDraft(
  input: GmailDraftInput,
  config: GmailConnectorConfig
): Promise<GmailDraftResult> {
  return createGmailDraftClient(config).createDraft(input);
}
