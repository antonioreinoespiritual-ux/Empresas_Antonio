/** Paginación por cursor (siguiente id) — usada por los listados de apps/agent-api (F3). */
export interface CursorPaginationInput {
  cursor?: string;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}
