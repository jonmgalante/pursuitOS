import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createId } from '@copilot/core';

const ARTIFACTS_DIR = path.resolve(
  /* turbopackIgnore: true */ process.cwd(),
  process.env.COPILOT_ARTIFACTS_DIR ?? '.artifacts'
);

async function ensureArtifactsDir(): Promise<void> {
  await fs.mkdir(ARTIFACTS_DIR, { recursive: true });
}

export async function savePageHtmlArtifact(params: {
  workspaceId: string;
  content: string;
}): Promise<{ id: string; storagePath: string; byteSize: number }> {
  await ensureArtifactsDir();

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
