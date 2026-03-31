import { redirectTo } from '../../../../../lib/http';
import { getFirstSliceService } from '../../../../../lib/services/first-slice-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const formData = await request.formData();
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const draftId = String(formData.get('draftId') ?? '');
  const redirectPath = String(formData.get('redirectTo') ?? '/');

  await getFirstSliceService().syncGmailDraftById(workspaceId, draftId);
  return redirectTo(request, redirectPath);
}
