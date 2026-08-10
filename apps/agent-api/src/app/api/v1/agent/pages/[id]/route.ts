import { authorizeAgentAction } from "@repo/core/domain";
import { agentAccess } from "@/lib/agent-access";
import { recordAgentAuditLog, resolveRequestId } from "@/lib/agent-auth";
import { performAgentPageWrite } from "@/lib/agent-page-write";
import { parseIfMatch } from "@/lib/if-match";
import { agentApiResponse, requireAgentRead, requireAgentWrite } from "@/lib/require-agent-access";

const PAGE_DETAIL_RATE_LIMIT = { limit: 120, windowMs: 60_000 };
const PAGE_PATCH_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

// A diferencia de /offers/:id, acá el offerId no se conoce hasta después de
// leer la Page (se direcciona por su propio id, F4 la necesita direccionable
// así) — por eso el chequeo de allowedOfferIds ocurre después del fetch, no
// antes. Se devuelve 404 (no 403) cuando existe pero está fuera de alcance,
// igual que /products/:id — no se confirma la existencia de un recurso
// fuera del alcance del caller vía un status distinto.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAgentRead({
    request,
    resourceType: "pages",
    routeKey: "pages:detail",
    rateLimit: PAGE_DETAIL_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const page = await agentAccess.pages.findById(params.id);

  const visible = page !== null && authorizeAgentAction(principal, { offerId: page.offerId, isWrite: false }).ok;

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "GET",
    resourceType: "pages",
    resourceId: params.id,
    statusCode: visible ? 200 : 404,
    latencyMs: Date.now() - startedAt,
    outcome: visible ? "read" : "not_found",
  });

  if (!visible) {
    return agentApiResponse(requestId, { error: "not_found" }, { status: 404 });
  }

  return agentApiResponse(requestId, { page });
}

interface PatchPageBody {
  content?: unknown;
  slug?: unknown;
}

/**
 * F4 — reemplaza el content completo de una Page existente, vía CAS
 * (`If-Match` = version esperada). offerId no se conoce hasta leer la Page
 * (direccionada por :id) — igual que GET, 404 (no 403) si existe pero está
 * fuera de allowedOfferIds, para no confirmar su existencia a quien no
 * tiene acceso.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ifMatch = parseIfMatch(request);
  if (ifMatch === null) {
    return agentApiResponse(resolveRequestId(request), { error: "missing_if_match" }, { status: 428 });
  }

  const auth = await requireAgentWrite({
    request,
    method: "PATCH",
    resourceType: "pages",
    routeKey: "pages:patch",
    rateLimit: PAGE_PATCH_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const page = await agentAccess.pages.findById(params.id);
  const visible = page !== null && authorizeAgentAction(principal, { offerId: page.offerId, isWrite: true }).ok;

  if (!visible) {
    await recordAgentAuditLog({
      requestId,
      apiClientId: principal.apiClientId,
      apiKeyId: principal.apiKeyId,
      method: "PATCH",
      resourceType: "pages",
      resourceId: params.id,
      statusCode: 404,
      latencyMs: Date.now() - startedAt,
      outcome: "not_found",
    });
    return agentApiResponse(requestId, { error: "not_found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as PatchPageBody | null;
  if (!body || body.content === undefined) {
    return agentApiResponse(requestId, { error: "invalid_body", detail: "content es requerido" }, { status: 400 });
  }

  const result = await performAgentPageWrite({
    request,
    principal,
    requestId,
    offerId: page.offerId,
    kind: page.kind,
    slug: (body.slug as string | null | undefined) ?? page.slug,
    content: body.content,
    expectedVersion: ifMatch,
    // Sin esto, updateWithVersionAudited defaultea a variantLabel=null y
    // termina escribiendo la Page PRIMARIA en vez de la variante
    // direccionada por :id — (offerId, kind) solas ya no identifican una
    // única fila desde que existen variantes (encontrado con un smoke test
    // real, no en el compilador).
    variantLabel: page.variantLabel,
    rateLimit: PAGE_PATCH_RATE_LIMIT,
  });

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "PATCH",
    resourceType: "pages",
    resourceId: params.id,
    statusCode: result.status,
    latencyMs: Date.now() - startedAt,
    outcome: result.status === 200 ? "updated" : `write_failed:${result.status}`,
  });

  return agentApiResponse(requestId, result.body, { status: result.status });
}
