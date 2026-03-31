import { redirectTo } from '../../../../lib/http';
import { getFirstSliceService } from '../../../../lib/services/first-slice-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const workspaceId = await getFirstSliceService().ensureDemoWorkspace();
  return redirectTo(request, `/workspaces/${workspaceId}`);
}
