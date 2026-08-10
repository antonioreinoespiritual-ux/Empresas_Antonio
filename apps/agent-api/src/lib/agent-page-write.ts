import { executeAgentPageWrite } from "@repo/core/application";
import type { AgentPrincipal, PageKind } from "@repo/core/domain";
import { hashRequestPayload } from "@repo/core/infrastructure";
import { agentAccess } from "./agent-access";

// Arbitrario — lo que importa (F2) es que la reserva sea atómica, no el
// valor exacto. 5 minutos alcanza para que un agente reintente una request
// que no confirmó haber recibido, sin dejar una ventana enorme donde un
// Idempotency-Key reciclado por accidente devuelva una respuesta vieja.
const IDEMPOTENCY_TTL_MS = 5 * 60_000;

export interface AgentPageWriteParams {
  request: Request;
  principal: AgentPrincipal;
  requestId: string;
  offerId: string;
  kind: PageKind;
  slug?: string | null;
  content: unknown;
  /** undefined = crear; definida = actualizar con CAS (viene del header If-Match en las rutas de blocks/reorder/PATCH). */
  expectedVersion?: number;
  /** Ambos presentes = variante A/B en vez de la Page primaria (POST /pages/:id/variants). */
  variantGroupId?: string | null;
  variantLabel?: string | null;
  rateLimit: { limit: number; windowMs: number };
}

export type AgentPageWriteResult = { status: number; body: unknown } | { status: 400; body: { error: "missing_idempotency_key" } };

/**
 * Wrapper compartido por todas las rutas de escritura de F4 (POST /pages,
 * PATCH /pages/:id, blocks, reorder): exige el header `Idempotency-Key` —
 * el plan solo lo menciona explícito para POST /pages, pero se exige acá en
 * todas por consistencia (executeAgentPageWrite ya lo requiere siempre; más
 * seguro exigirlo en todo el camino de escritura que solo en una ruta).
 */
export async function performAgentPageWrite(params: AgentPageWriteParams): Promise<AgentPageWriteResult> {
  const idempotencyKey = params.request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return { status: 400, body: { error: "missing_idempotency_key" } };
  }

  const requestHash = hashRequestPayload({
    offerId: params.offerId,
    kind: params.kind,
    slug: params.slug ?? null,
    content: params.content,
    expectedVersion: params.expectedVersion ?? null,
    variantGroupId: params.variantGroupId ?? null,
    variantLabel: params.variantLabel ?? null,
  });

  const result = await executeAgentPageWrite(
    { pages: agentAccess.pages, rateLimits: agentAccess.rateLimits, idempotency: agentAccess.idempotency },
    {
      requestId: params.requestId,
      apiClientId: params.principal.apiClientId,
      apiKeyId: params.principal.apiKeyId,
      idempotencyKey,
      requestHash,
      now: new Date(),
      rateLimit: params.rateLimit,
      idempotencyTtlMs: IDEMPOTENCY_TTL_MS,
      page: {
        offerId: params.offerId,
        kind: params.kind,
        slug: params.slug,
        content: params.content,
        expectedVersion: params.expectedVersion,
        variantGroupId: params.variantGroupId,
        variantLabel: params.variantLabel,
      },
    }
  );

  return { status: result.status, body: result.body };
}
