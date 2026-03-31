export const DEFAULT_DATABASE_URL = 'postgresql://copilot:copilot@localhost:5432/conference_copilot';

export function resolveDatabaseUrl(explicitUrl?: string): string {
  return explicitUrl ?? process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}
