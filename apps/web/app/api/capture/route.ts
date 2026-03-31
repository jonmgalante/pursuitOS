import {
  createExtensionCaptureErrorResponse,
  createExtensionCaptureSuccessResponse,
  parseExtensionCaptureRequest
} from '@copilot/core';
import { corsJson } from '../../../lib/http';
import { getFirstSliceService } from '../../../lib/services/first-slice-service';

export const runtime = 'nodejs';

export async function OPTIONS() {
  return corsJson({ ok: true });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return corsJson(
      createExtensionCaptureErrorResponse('Capture request body must be valid JSON.'),
      { status: 400 }
    );
  }

  const parsed = parseExtensionCaptureRequest(body);
  if (!parsed.ok) {
    return corsJson(createExtensionCaptureErrorResponse(parsed.error, parsed.issues), { status: 400 });
  }

  const result = await getFirstSliceService().ingestCapture(
    parsed.value.workspaceId,
    parsed.value.capture
  );

  return corsJson(
    createExtensionCaptureSuccessResponse({
      workspaceId: parsed.value.workspaceId,
      pageUrl: parsed.value.capture.pageUrl,
      pageTitle: parsed.value.capture.pageTitle,
      pageType: parsed.value.capture.pageType,
      capturedAt: parsed.value.capture.capturedAt,
      pageTextSummary: parsed.value.capture.pageTextSummary,
      totalRecords: result.totalRecords,
      addedPeople: result.addedPeople,
      addedSessions: result.addedSessions
    })
  );
}
