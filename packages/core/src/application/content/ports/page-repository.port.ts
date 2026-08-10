import type { Page, PageKind, PageStatus } from "../../../domain";

export interface CreatePageInput {
  offerId: string;
  kind: PageKind;
  slug?: string | null;
  content: unknown;
}

export interface UpdatePageWithVersionInput {
  offerId: string;
  kind: PageKind;
  slug?: string | null;
  content: unknown;
  /** Version leída por el llamador antes de escribir — la base de la CAS. */
  expectedVersion: number;
}

export interface AgentPageAuditContext {
  requestId: string;
  apiClientId: string;
  apiKeyId?: string | null;
}

export interface PageRepository {
  findByOfferAndKind(offerId: string, kind: PageKind): Promise<Page | null>;
  findPublishedBySlug(slug: string): Promise<Page | null>;
  /** Throws ConflictError si (offerId, kind) ya existe — la Page la creó otra escritura concurrente. */
  createInitial(input: CreatePageInput): Promise<Page>;
  /**
   * UPDATE ... WHERE version = expectedVersion, atómico (CAS — Agent Access
   * Layer, ADR-06). Throws VersionConflictError si 0 filas fueron
   * afectadas: alguien más escribió esta Page desde que el llamador la leyó.
   * Usada por el panel admin (sin auditoría forzada — no es un agente).
   */
  updateWithVersion(input: UpdatePageWithVersionInput): Promise<Page>;
  /**
   * Igual que updateWithVersion, pero la CAS y el INSERT en AgentAuditLog
   * ocurren en la misma transacción — mismo commit o mismo rollback. Solo
   * para escrituras originadas por un agente autenticado.
   */
  updateWithVersionAudited(input: UpdatePageWithVersionInput, audit: AgentPageAuditContext): Promise<Page>;
  setStatus(pageId: string, status: PageStatus): Promise<void>;
}
