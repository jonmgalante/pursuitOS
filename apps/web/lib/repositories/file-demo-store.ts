import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createId, type DemoStore, DEMO_HUBSPOT_DIRECTORY } from '@copilot/core';

const STORE_DIR = path.join(process.cwd(), '.data');
const STORE_PATH = path.join(STORE_DIR, 'demo-store.json');
const ARTIFACTS_DIR = path.join(process.cwd(), '.artifacts');

function emptyDemoStore(): DemoStore {
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

async function ensureDemoStoreDirs(): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
}

export async function readDemoStore(): Promise<DemoStore> {
  await ensureDemoStoreDirs();

  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    return JSON.parse(raw) as DemoStore;
  } catch {
    const store = emptyDemoStore();
    await writeDemoStore(store);
    return store;
  }
}

export async function writeDemoStore(store: DemoStore): Promise<void> {
  await ensureDemoStoreDirs();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

export async function savePageHtmlArtifact(params: {
  workspaceId: string;
  content: string;
}): Promise<{ id: string; storagePath: string; byteSize: number }> {
  const folder = path.join(ARTIFACTS_DIR, params.workspaceId);
  await fs.mkdir(folder, { recursive: true });

  const artifactId = createId('artifact');
  const filePath = path.join(folder, `${artifactId}.html`);
  await fs.writeFile(filePath, params.content, 'utf-8');

  return {
    id: artifactId,
    storagePath: filePath,
    byteSize: Buffer.byteLength(params.content, 'utf-8')
  };
}
