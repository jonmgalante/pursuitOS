import type { Encounter } from '@copilot/core';
import { redirectTo } from '../../../lib/http';
import { getFirstSliceService } from '../../../lib/services/first-slice-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const formData = await request.formData();
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const personId = String(formData.get('personId') ?? '');
  const noteText = String(formData.get('noteText') ?? '');
  const redirectPath = String(formData.get('redirectTo') ?? '/');
  const capturedVia = String(formData.get('capturedVia') ?? 'MANUAL') as Encounter['capturedVia'];
  const outcome = String(formData.get('outcome') ?? '').trim();
  const sessionId = String(formData.get('sessionId') ?? '').trim();
  const speakerPersonId = String(formData.get('speakerPersonId') ?? '').trim();
  const tags = formData.getAll('tags').map((value) => String(value));

  await getFirstSliceService().logEncounter({
    workspaceId,
    personId,
    noteText,
    tags,
    outcome: outcome === 'MET' || outcome === 'MISSED' ? outcome : undefined,
    sessionId: sessionId || undefined,
    speakerPersonId: speakerPersonId || undefined,
    capturedVia
  });

  return redirectTo(request, redirectPath);
}
