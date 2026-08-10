import { parsePageContent, VersionConflictError, type Page, type PageKind } from "../../../domain";
import type { PageRepository } from "../../content/ports/page-repository.port";
import type { RateLimitRepository } from "../ports/rate-limit-repository.port";
import type { IdempotencyRepository } from "../ports/idempotency-repository.port";
import { enforceRateLimit } from "./enforce-rate-limit.use-case";
import { withIdempotency } from "./with-idempotency.use-case";

export interface ExecuteAgentPageUpdateDeps {
  pages: PageRepository;
  rateLimits: RateLimitRepository;
  idempotency: IdempotencyRepository;
}

export interface ExecuteAgentPageUpdateInput {
  requestId: string;
  apiClientId: string;
  apiKeyId: string;
  idempotencyKey: string;
  requestHash: string;
  now: Date;
  rateLimit: { limit: number; windowMs: number };
  idempotencyTtlMs: number;
  page: {
    offerId: string;
    kind: PageKind;
    slug?: string | null;
    content: unknown;
    expectedVersion: number;
  };
}

export interface AgentPageUpdateBody {
  page?: Page;
  error?: string;
}

/**
 * Infraestructura transversal de F2 (rate limit + idempotencia + CAS +
 * auditoría atómica) sobre la única mutación de negocio que el Agent
 * Access Layer necesita hasta ahora: escribir Page.content. Ninguna ruta
 * HTTP de apps/agent-api llama a esto todavía — expone el mecanismo listo
 * para que F4 ("escritura agentic") lo use vía un endpoint real, sin
 * adelantar esa fase.
 *
 * Orden deliberado: el rate limit se aplica ANTES de la idempotencia (una
 * request que ya no tiene cupo ni siquiera reserva una Idempotency-Key), y
 * el conflicto de versión se modela como {status:409,...} dentro de
 * `execute`, nunca como excepción — así también queda cacheado si la misma
 * key+payload se reintenta.
 */
export async function executeAgentPageUpdate(
  deps: ExecuteAgentPageUpdateDeps,
  input: ExecuteAgentPageUpdateInput
): Promise<{ status: number; body: AgentPageUpdateBody; executed: boolean }> {
  await enforceRateLimit(
    { rateLimits: deps.rateLimits },
    {
      apiKeyId: input.apiKeyId,
      routeKey: "pages:update",
      limit: input.rateLimit.limit,
      windowMs: input.rateLimit.windowMs,
      now: input.now,
    }
  );

  return withIdempotency<AgentPageUpdateBody>(
    { idempotency: deps.idempotency },
    {
      apiClientId: input.apiClientId,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      ttlMs: input.idempotencyTtlMs,
      now: input.now,
    },
    async () => {
      const content = parsePageContent(input.page.kind, input.page.content);
      try {
        const page = await deps.pages.updateWithVersionAudited(
          {
            offerId: input.page.offerId,
            kind: input.page.kind,
            slug: input.page.slug,
            content,
            expectedVersion: input.page.expectedVersion,
          },
          { requestId: input.requestId, apiClientId: input.apiClientId, apiKeyId: input.apiKeyId }
        );
        return { status: 200, body: { page } };
      } catch (error) {
        if (error instanceof VersionConflictError) {
          return { status: 409, body: { error: error.message } };
        }
        throw error;
      }
    }
  );
}
