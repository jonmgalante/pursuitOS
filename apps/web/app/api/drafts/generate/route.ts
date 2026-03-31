import { redirectTo } from '../../../../lib/http';
import { generateDraft } from '../../../../lib/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const formData = await request.formData();
  const workspaceId = String(formData.get('workspaceId') ?? '');
  const personId = String(formData.get('personId') ?? '');
  const redirectPath = String(formData.get('redirectTo') ?? '/');

  await generateDraft(workspaceId, personId);
  return redirectTo(request, redirectPath);
}
