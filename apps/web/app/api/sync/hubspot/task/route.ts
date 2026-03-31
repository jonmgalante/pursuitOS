import { redirectTo } from '../../../../../lib/http';
import { getFirstSliceService } from '../../../../../lib/services/first-slice-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const formData = await request.formData();
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const personId = String(formData.get('personId') ?? '');
  const redirectPath = String(formData.get('redirectTo') ?? '/');

  await getFirstSliceService().syncHubSpotTaskForPerson(workspaceId, personId);
  return redirectTo(request, redirectPath);
}
