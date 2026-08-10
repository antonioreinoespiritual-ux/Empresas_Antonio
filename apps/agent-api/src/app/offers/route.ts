import { agentAccess } from "@/lib/agent-access";
import { recordAgentAuditLog } from "@/lib/agent-auth";
import { agentReadResponse, requireAgentRead } from "@/lib/require-agent-read";

const OFFERS_LIST_RATE_LIMIT = { limit: 60, windowMs: 60_000 };

// Sin filtro por allowedOfferIds — instrucción explícita de Antonio: la
// lectura de catálogo en F3 no está acotada por Offer (a diferencia de la
// escritura, que sí la respetará en F4). list() ya trae `prices` embebidas
// (OfferListItem) — no existe un OfferRepository/PriceRepository separado.
export async function GET(request: Request) {
  const auth = await requireAgentRead({
    request,
    resourceType: "offers",
    routeKey: "offers:list",
    rateLimit: OFFERS_LIST_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const offers = await agentAccess.offers.list();

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

  return agentReadResponse(requestId, {
    offers,
    rateLimit: { limit: auth.rateLimit.limit, remaining: auth.rateLimit.remaining },
  });
}
