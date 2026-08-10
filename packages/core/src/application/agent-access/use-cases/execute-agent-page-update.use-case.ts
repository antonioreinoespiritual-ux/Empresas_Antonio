import { ZodError } from "zod";
import { ConflictError, parsePageContent, VersionConflictError, type Page, type PageKind } from "../../../domain";
import type { PageRepository } from "../../content/ports/page-repository.port";
import type { RateLimitRepository } from "../ports/rate-limit-repository.port";
import type { IdempotencyRepository } from "../ports/idempotency-repository.port";
import { enforceRateLimit } from "./enforce-rate-limit.use-case";
import { withIdempotency } from "./with-idempotency.use-case";

export interface ExecuteAgentPageWriteDeps {
  pages: PageRepository;
  rateLimits: RateLimitRepository;
  idempotency: IdempotencyRepository;
}

export interface ExecuteAgentPageWriteInput {
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
    /** undefined = crear (createInitialAudited); definida = actualizar con CAS (updateWithVersionAudited). */
    expectedVersion?: number;
    /** Ambos presentes = crear/actualizar una variante A/B en vez de la Page primaria (F4). */
    variantGroupId?: string | null;
    variantLabel?: string | null;
  };
}

export interface AgentPageWriteBody {
  page?: Page;
  error?: string;
}

/**
 * Infraestructura transversal de F2 (rate limit + idempotencia + CAS +
 * auditoría atómica) sobre la mutación de negocio que el Agent Access Layer
 * necesita: crear o escribir Page.content (F4 — "escritura agentic"). Antes
 * (F2) solo soportaba actualizar; ahora decide crear vs. actualizar según si
 * el llamador trae `expectedVersion` — mismo criterio que `savePageContent`
 * usa para el panel humano.
 *
 * Orden deliberado: el rate limit se aplica ANTES de la idempotencia (una
 * request que ya no tiene cupo ni siquiera reserva una Idempotency-Key), y
 * tanto el conflicto de versión como el de creación duplicada se modelan
 * como {status:409,...} dentro de `execute`, nunca como excepción — así
 * también quedan cacheados si la misma key+payload se reintenta.
 */
export async function executeAgentPageWrite(
  deps: ExecuteAgentPageWriteDeps,
  input: ExecuteAgentPageWriteInput
): Promise<{ status: number; body: AgentPageWriteBody; executed: boolean }> {
  await enforceRateLimit(
    { rateLimits: deps.rateLimits },
    {
      apiKeyId: input.apiKeyId,
      routeKey: "pages:write",
      limit: input.rateLimit.limit,
      windowMs: input.rateLimit.windowMs,
      now: input.now,
    }
  );

  return withIdempotency<AgentPageWriteBody>(
    { idempotency: deps.idempotency },
    {
      apiClientId: input.apiClientId,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      ttlMs: input.idempotencyTtlMs,
      now: input.now,
    },
    async () => {
      let content: unknown;
      try {
        content = parsePageContent(input.page.kind, input.page.content);
      } catch (error) {
        // Antes de este fix (F4) esta excepción se colaba sin capturar fuera
        // de executeAgentPageWrite — cada ruta HTTP la traduce igual a 400,
        // así que se centraliza acá una sola vez para todos los llamadores.
        if (error instanceof ZodError) {
          return { status: 400, body: { error: "invalid_content", detail: error.message } };
        }
        throw error;
      }
      const audit = { requestId: input.requestId, apiClientId: input.apiClientId, apiKeyId: input.apiKeyId };

      if (input.page.expectedVersion === undefined) {
        try {
          const page = await deps.pages.createInitialAudited(
            {
              offerId: input.page.offerId,
              kind: input.page.kind,
              slug: input.page.slug,
              content,
              variantGroupId: input.page.variantGroupId,
              variantLabel: input.page.variantLabel,
            },
            audit
          );
          return { status: 201, body: { page } };
        } catch (error) {
          if (error instanceof ConflictError) {
            return { status: 409, body: { error: error.message } };
          }
          throw error;
        }
      }

      try {
        const page = await deps.pages.updateWithVersionAudited(
          {
            offerId: input.page.offerId,
            kind: input.page.kind,
            slug: input.page.slug,
            content,
            expectedVersion: input.page.expectedVersion,
            variantLabel: input.page.variantLabel,
          },
          audit
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
