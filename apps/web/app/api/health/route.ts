import { corsJson } from '../../../lib/http';

export const runtime = 'nodejs';

export async function GET() {
  return corsJson({
    ok: true,
    service: 'conference-rep-copilot-web'
  });
}

export async function OPTIONS() {
  return corsJson({ ok: true });
}
