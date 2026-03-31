import type { Encounter } from '@copilot/core';
import { redirectTo } from '../../../lib/http';
import { logEncounter } from '../../../lib/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const formData = await request.formData();
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const personId = String(formData.get('personId') ?? '');
  const noteText = String(formData.get('noteText') ?? '');
  const redirectPath = String(formData.get('redirectTo') ?? '/');
  const capturedVia = String(formData.get('capturedVia') ?? 'MANUAL') as Encounter['capturedVia'];
  const tags = formData.getAll('tags').map((value) => String(value));

  await logEncounter({
    workspaceId,
    personId,
    noteText,
    tags,
    capturedVia
  });

  return redirectTo(request, redirectPath);
}
