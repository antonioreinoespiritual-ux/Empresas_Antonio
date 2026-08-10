const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

/** `limit` inválido o ausente cae al default; nunca supera MAX_PAGE_LIMIT. */
export function parsePageLimit(raw: string | null): number {
  if (!raw) return DEFAULT_PAGE_LIMIT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(parsed, MAX_PAGE_LIMIT);
}
