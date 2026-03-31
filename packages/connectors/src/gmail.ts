import type { ConnectorResult, GmailDraftInput } from './types';

const GMAIL_DRAFTS_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/drafts';

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

export async function createGmailDraft(
  input: GmailDraftInput,
  accessToken = process.env.GMAIL_ACCESS_TOKEN
): Promise<ConnectorResult> {
  if (!accessToken) {
    return {
      provider: 'GMAIL',
      mode: 'mock',
      externalId: `mock_gmail_draft_${Date.now()}`
    };
  }

  const raw = base64UrlEncode(buildMimeMessage(input));

  const response = await fetch(GMAIL_DRAFTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        raw
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail draft create failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { id: string };

  return {
    provider: 'GMAIL',
    mode: 'live',
    externalId: data.id
  };
}
