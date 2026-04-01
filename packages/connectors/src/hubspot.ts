import {
  ConnectorSyncError,
  type HubSpotConnectorConfig,
  type HubSpotTaskClient,
  type HubSpotTaskInput,
  type HubSpotTaskResult
} from './types';

const HUBSPOT_API_BASE_URL = 'https://api.hubapi.com';
const HUBSPOT_TASKS_PATH = '/crm/v3/objects/tasks';
const HUBSPOT_TASK_TO_CONTACT_ASSOCIATION_TYPE_ID = 204;

function connectorUrl(baseUrl: string | undefined, path: string): string {
  const normalizedBaseUrl = (baseUrl ?? HUBSPOT_API_BASE_URL).replace(/\/+$/, '');
  return `${normalizedBaseUrl}${path}`;
}

function truncate(value: string, maxLength = 280): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

async function responseText(response: Response): Promise<string | undefined> {
  const text = (await response.text()).trim();
  return text ? truncate(text) : undefined;
}

function taskAssociations(input: HubSpotTaskInput) {
  if (!input.contact?.hubspotContactId) {
    return undefined;
  }

  return [
    {
      to: {
        id: input.contact.hubspotContactId
      },
      types: [
        {
          associationCategory: 'HUBSPOT_DEFINED' as const,
          associationTypeId: HUBSPOT_TASK_TO_CONTACT_ASSOCIATION_TYPE_ID
        }
      ]
    }
  ];
}

function buildTaskPayload(input: HubSpotTaskInput) {
  const associations = taskAssociations(input);

  return {
    properties: {
      hs_task_subject: input.subject,
      hs_task_body: input.body,
      hs_timestamp: input.dueAt
    },
    ...(associations ? { associations } : {})
  };
}

function createMockHubSpotTaskClient(): HubSpotTaskClient {
  return {
    async createTask(input: HubSpotTaskInput): Promise<HubSpotTaskResult> {
      return {
        provider: 'HUBSPOT',
        mode: 'mock',
        externalId: `mock_hs_task_${Date.now()}`,
        linkedContactId: input.contact?.hubspotContactId
      };
    }
  };
}

function createLiveHubSpotTaskClient(config: Extract<HubSpotConnectorConfig, { mode: 'live' }>): HubSpotTaskClient {
  return {
    async createTask(input: HubSpotTaskInput): Promise<HubSpotTaskResult> {
      const response = await fetch(connectorUrl(config.apiBaseUrl, HUBSPOT_TASKS_PATH), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken.value}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(buildTaskPayload(input))
      });

      if (!response.ok) {
        throw new ConnectorSyncError({
          provider: 'HUBSPOT',
          mode: 'live',
          operation: 'HUBSPOT_TASK_CREATE',
          code: 'HTTP_ERROR',
          publicMessage: `HubSpot task creation failed with HTTP ${response.status}.`,
          statusCode: response.status,
          logMessage: await responseText(response)
        });
      }

      const data = (await response.json()) as { id?: unknown };

      if (typeof data.id !== 'string' || !data.id.trim()) {
        throw new ConnectorSyncError({
          provider: 'HUBSPOT',
          mode: 'live',
          operation: 'HUBSPOT_TASK_CREATE',
          code: 'INVALID_RESPONSE',
          publicMessage: 'HubSpot task creation returned an invalid response.',
          logMessage: 'Response JSON did not include a string id.'
        });
      }

      return {
        provider: 'HUBSPOT',
        mode: 'live',
        externalId: data.id,
        linkedContactId: input.contact?.hubspotContactId
      };
    }
  };
}

export function createHubSpotTaskClient(config: HubSpotConnectorConfig): HubSpotTaskClient {
  return config.mode === 'mock' ? createMockHubSpotTaskClient() : createLiveHubSpotTaskClient(config);
}

export async function createHubSpotTask(
  input: HubSpotTaskInput,
  config: HubSpotConnectorConfig
): Promise<HubSpotTaskResult> {
  return createHubSpotTaskClient(config).createTask(input);
}
