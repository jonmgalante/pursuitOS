import { redirectTo } from '../../../../../lib/http';
import { syncGmailDraftById } from '../../../../../lib/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const formData = await request.formData();
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const draftId = String(formData.get('draftId') ?? '');
  const redirectPath = String(formData.get('redirectTo') ?? '/');

  await syncGmailDraftById(workspaceId, draftId);
  return redirectTo(request, redirectPath);
}
