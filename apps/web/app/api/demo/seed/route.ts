import { ensureDemoWorkspace } from '../../../../lib/store';
import { redirectTo } from '../../../../lib/http';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const workspaceId = await ensureDemoWorkspace();
  return redirectTo(request, `/workspaces/${workspaceId}`);
}
