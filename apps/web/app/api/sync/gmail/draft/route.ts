import { redirectTo, requiredFormValue } from '../../../../../lib/http';
import { getFirstSliceService } from '../../../../../lib/services/first-slice-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const formData = await request.formData();
  const workspaceId = requiredFormValue(formData, 'workspaceId');
  const draftId = requiredFormValue(formData, 'draftId');
  const redirectPath = String(formData.get('redirectTo') ?? '/').trim() || '/';

  await getFirstSliceService().syncGmailDraftById(workspaceId, draftId);
  return redirectTo(request, redirectPath);
}
