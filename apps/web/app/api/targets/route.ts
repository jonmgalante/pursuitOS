import type { TargetPriority, TargetStatus } from '@copilot/core';
import { redirectTo } from '../../../lib/http';
import { getFirstSliceService } from '../../../lib/services/first-slice-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const formData = await request.formData();
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const personId = String(formData.get('personId') ?? '');
  const intent = String(formData.get('intent') ?? 'create');
  const redirectPath = String(formData.get('redirectTo') ?? '/');

  if (intent === 'status') {
    const status = String(formData.get('status') ?? 'TARGETED') as TargetStatus;
    await getFirstSliceService().updateTargetStatus(workspaceId, personId, status);
    return redirectTo(request, redirectPath);
  }

  const priority = String(formData.get('priority') ?? 'BACKUP') as TargetPriority;
  await getFirstSliceService().markTarget(workspaceId, personId, priority);
  return redirectTo(request, redirectPath);
}
