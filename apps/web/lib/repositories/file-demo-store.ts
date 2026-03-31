import { promises as fs } from 'node:fs';
import path from 'node:path';
import { type DemoStore, DEMO_HUBSPOT_DIRECTORY } from '@copilot/core';
export { savePageHtmlArtifact } from './local-artifact-store';

const STORE_DIR = path.resolve(
  /* turbopackIgnore: true */ process.cwd(),
  process.env.COPILOT_FILE_STORE_DIR ?? '.data'
);
const STORE_PATH = path.join(STORE_DIR, 'demo-store.json');

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
