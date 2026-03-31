import type { ConnectorResult, HubSpotTaskInput } from './types';

const HUBSPOT_TASKS_URL = 'https://api.hubapi.com/crm/v3/objects/tasks';

export async function createHubSpotTask(
  input: HubSpotTaskInput,
  accessToken = process.env.HUBSPOT_ACCESS_TOKEN
): Promise<ConnectorResult> {
  if (!accessToken) {
    return {
      provider: 'HUBSPOT',
      mode: 'mock',
      externalId: `mock_hs_task_${Date.now()}`
    };
  }

  const response = await fetch(HUBSPOT_TASKS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        hs_task_subject: input.subject,
        hs_task_body: input.body,
        hs_timestamp: input.dueAt
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HubSpot task create failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { id: string };

  return {
    provider: 'HUBSPOT',
    mode: 'live',
    externalId: data.id
  };
}
