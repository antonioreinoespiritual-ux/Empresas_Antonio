import { agentAccess } from "@/lib/agent-access";
import { recordAgentAuditLog } from "@/lib/agent-auth";
import { parsePageLimit } from "@/lib/pagination";
import { agentApiResponse, requireAgentRead } from "@/lib/require-agent-access";

const OFFERS_LIST_RATE_LIMIT = { limit: 60, windowMs: 60_000 };

// Retrofit F3 (PLAN-AGENT-API-01): antes esta ruta no filtraba por
// allowedOfferIds — corregido para que la lista solo incluya las Offers
// del alcance del ApiClient (null = todas). list() ya trae `prices`
// embebidas (OfferListItem) — no existe un OfferRepository/PriceRepository
// separado.
export async function GET(request: Request) {
  const auth = await requireAgentRead({
    request,
    resourceType: "offers",
    routeKey: "offers:list",
    rateLimit: OFFERS_LIST_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const { searchParams } = new URL(request.url);
  const { items: offers, nextCursor } = await agentAccess.offers.listForAgent({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: parsePageLimit(searchParams.get("limit")),
    allowedOfferIds: principal.allowedOfferIds,
  });

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "GET",
    resourceType: "offers",
    statusCode: 200,
    latencyMs: Date.now() - startedAt,
    outcome: "read",
  });

  return agentApiResponse(requestId, {
    offers,
    nextCursor,
    rateLimit: { limit: auth.rateLimit.limit, remaining: auth.rateLimit.remaining },
  });
}
