import { redirectTo, requiredFormValue } from '../../../../../lib/http';
import { getFirstSliceService } from '../../../../../lib/services/first-slice-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const formData = await request.formData();
  const workspaceId = requiredFormValue(formData, 'workspaceId');
  const personId = requiredFormValue(formData, 'personId');
  const redirectPath = String(formData.get('redirectTo') ?? '/').trim() || '/';

  await getFirstSliceService().syncHubSpotTaskForPerson(workspaceId, personId);
  return redirectTo(request, redirectPath);
}
