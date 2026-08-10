import type { PageKind } from "@repo/core/domain";
import { agentAccess } from "@/lib/agent-access";
import { recordAgentAuditLog, resolveRequestId } from "@/lib/agent-auth";
import { performAgentPageWrite } from "@/lib/agent-page-write";
import { parsePageLimit } from "@/lib/pagination";
import { agentApiResponse, requireAgentRead, requireAgentWrite } from "@/lib/require-agent-access";

const PAGES_READ_RATE_LIMIT = { limit: 60, windowMs: 60_000 };
const PAGES_WRITE_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

const PAGE_KINDS: readonly PageKind[] = ["LANDING", "CHECKOUT", "THANK_YOU"];

function isPageKind(value: string): value is PageKind {
  return (PAGE_KINDS as readonly string[]).includes(value);
}

// Retrofit F3 (PLAN-AGENT-API-01): antes esta ruta solo hacía un lookup
// puntual por (offerId, kind), sin paginación ni allowedOfferIds. Ahora es
// un listado paginado — offerId/kind quedan como filtros opcionales (si se
// pasa offerId, se valida contra allowedOfferIds con un 403 explícito antes
// de tocar la base; sin offerId, la lista completa ya viene acotada por
// allowedOfferIds vía el filtro en la query).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offerId = searchParams.get("offerId") ?? undefined;
  const kindParam = searchParams.get("kind");

  const auth = await requireAgentRead({
    request,
    resourceType: "pages",
    routeKey: "pages:list",
    rateLimit: PAGES_READ_RATE_LIMIT,
    offerId,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;

  if (kindParam !== null && !isPageKind(kindParam)) {
    return agentApiResponse(
      requestId,
      { error: "invalid_query", detail: `kind debe ser uno de: ${PAGE_KINDS.join(", ")}` },
      { status: 400 }
    );
  }
  const kind = kindParam ?? undefined;
  const { items: pages, nextCursor } = await agentAccess.pages.listForAgent({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: parsePageLimit(searchParams.get("limit")),
    allowedOfferIds: principal.allowedOfferIds,
    offerId,
    kind,
  });

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "GET",
    resourceType: "pages",
    statusCode: 200,
    latencyMs: Date.now() - startedAt,
    outcome: "read",
  });

  return agentApiResponse(requestId, {
    pages,
    nextCursor,
    rateLimit: { limit: auth.rateLimit.limit, remaining: auth.rateLimit.remaining },
  });
}

interface CreatePageBody {
  offerId?: unknown;
  kind?: unknown;
  slug?: unknown;
  content?: unknown;
}

/**
 * F4 — escritura agentic: crea una Page nueva. Body inválido -> 400 antes
 * de autenticar (no requiere tocar la base ni filtra nada sensible); scope
 * "write" + allowedOfferIds -> 403; Idempotency-Key ausente -> 400;
 * (offerId, kind) ya existente -> 409 (ConflictError, vía executeAgentPageWrite).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreatePageBody | null;
  if (
    !body ||
    typeof body.offerId !== "string" ||
    typeof body.kind !== "string" ||
    !isPageKind(body.kind) ||
    (body.slug !== undefined && body.slug !== null && typeof body.slug !== "string") ||
    body.content === undefined
  ) {
    return agentApiResponse(resolveRequestId(request), {
      error: "invalid_body",
      detail: "offerId (string) y kind (LANDING|CHECKOUT|THANK_YOU) y content son requeridos; slug es opcional (string|null)",
    }, { status: 400 });
  }

  const auth = await requireAgentWrite({
    request,
    method: "POST",
    resourceType: "pages",
    routeKey: "pages:create",
    rateLimit: PAGES_WRITE_RATE_LIMIT,
    offerId: body.offerId,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const result = await performAgentPageWrite({
    request,
    principal,
    requestId,
    offerId: body.offerId,
    kind: body.kind,
    slug: (body.slug as string | null | undefined) ?? null,
    content: body.content,
    rateLimit: PAGES_WRITE_RATE_LIMIT,
  });

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "POST",
    resourceType: "pages",
    statusCode: result.status,
    latencyMs: Date.now() - startedAt,
    outcome: result.status === 201 ? "created" : `write_failed:${result.status}`,
  });

  return agentApiResponse(requestId, result.body, { status: result.status });
}
