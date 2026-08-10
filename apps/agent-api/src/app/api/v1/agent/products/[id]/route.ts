import { agentAccess } from "@/lib/agent-access";
import { recordAgentAuditLog } from "@/lib/agent-auth";
import { agentApiResponse, requireAgentRead } from "@/lib/require-agent-access";

const PRODUCT_DETAIL_RATE_LIMIT = { limit: 120, windowMs: 60_000 };

// Product no tiene un único offerId (relación 1-a-muchos con Offer) — no hay
// un solo valor que pasarle a authorizeAgentAction. findByIdForAgent hace el
// filtro en la propia query (visible si tiene al menos una Offer dentro de
// allowedOfferIds) y devuelve null tanto si no existe como si existe pero
// está fuera de alcance — 404 en ambos casos, sin distinguir (no se confirma
// la existencia de un recurso fuera del alcance del caller).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAgentRead({
    request,
    resourceType: "products",
    routeKey: "products:detail",
    rateLimit: PRODUCT_DETAIL_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const product = await agentAccess.products.findByIdForAgent(params.id, principal.allowedOfferIds);

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "GET",
    resourceType: "products",
    resourceId: params.id,
    statusCode: product ? 200 : 404,
    latencyMs: Date.now() - startedAt,
    outcome: product ? "read" : "not_found",
  });

  if (!product) {
    return agentApiResponse(requestId, { error: "not_found" }, { status: 404 });
  }

  return agentApiResponse(requestId, { product });
}
