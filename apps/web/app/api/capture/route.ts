import type { CapturePagePayload } from '@copilot/core';
import { corsJson } from '../../../lib/http';
import { ingestCapture } from '../../../lib/store';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return corsJson({ ok: true });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { workspaceId?: string; capture?: CapturePagePayload };

  if (!body.workspaceId || !body.capture) {
    return corsJson(
      {
        ok: false,
        error: 'workspaceId and capture are required'
      },
      { status: 400 }
    );
  }

  const result = await ingestCapture(body.workspaceId, body.capture);

  return corsJson({
    ok: true,
    ...result
  });
}
