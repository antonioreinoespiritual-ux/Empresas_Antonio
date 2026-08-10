import type { Page, PageKind, PageStatus } from "../../../domain";
import type { CursorPaginationInput, PaginatedResult } from "../../shared/paginated-result";

export interface CreatePageInput {
  offerId: string;
  kind: PageKind;
  slug?: string | null;
  content: unknown;
  /** Ausentes/null = Page primaria. Ambos presentes = una variante A/B (F4) — ver migración page_variant_label_unique. */
  variantGroupId?: string | null;
  variantLabel?: string | null;
}

export interface UpdatePageWithVersionInput {
  offerId: string;
  kind: PageKind;
  slug?: string | null;
  content: unknown;
  /** Version leída por el llamador antes de escribir — la base de la CAS. */
  expectedVersion: number;
  /**
   * null (default) = la Page primaria. Necesario para direccionar
   * correctamente desde que existen variantes (F4): (offerId, kind) solas
   * ya no identifican una única fila — puede haber una primaria y N
   * variantes para la misma Offer+kind.
   */
  variantLabel?: string | null;
}

export interface AgentPageAuditContext {
  requestId: string;
  apiClientId: string;
  apiKeyId?: string | null;
}

export interface ListPagesForAgentInput extends CursorPaginationInput {
  /** null = sin restricción; array = solo Pages de estas Offers (F3 retrofit, PLAN-AGENT-API-01). */
  allowedOfferIds: string[] | null;
  offerId?: string;
  kind?: PageKind;
}

export interface PageRepository {
  findById(pageId: string): Promise<Page | null>;
  findByOfferAndKind(offerId: string, kind: PageKind): Promise<Page | null>;
  findPublishedBySlug(slug: string): Promise<Page | null>;
  /** Variante para apps/agent-api: paginada, acotada por allowedOfferIds y filtrable por offerId/kind. */
  listForAgent(input: ListPagesForAgentInput): Promise<PaginatedResult<Page>>;
  /** Throws ConflictError si (offerId, kind) ya existe — la Page la creó otra escritura concurrente. */
  createInitial(input: CreatePageInput): Promise<Page>;
  /** Igual que createInitial, pero el INSERT de la Page y el de AgentAuditLog viajan en la misma transacción (F4 — escritura agentic). */
  createInitialAudited(input: CreatePageInput, audit: AgentPageAuditContext): Promise<Page>;
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
