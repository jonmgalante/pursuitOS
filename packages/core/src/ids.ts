export function createId(prefix: string): string {
  const id = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}_${id.replaceAll('-', '').slice(0, 12)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
