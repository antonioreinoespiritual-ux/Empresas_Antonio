import { agentAccess } from "@/lib/agent-access";
import { recordAgentAuditLog } from "@/lib/agent-auth";
import { parsePageLimit } from "@/lib/pagination";
import { agentApiResponse, requireAgentRead } from "@/lib/require-agent-access";

const PRODUCTS_LIST_RATE_LIMIT = { limit: 60, windowMs: 60_000 };

export async function GET(request: Request) {
  const auth = await requireAgentRead({
    request,
    resourceType: "products",
    routeKey: "products:list",
    rateLimit: PRODUCTS_LIST_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const { searchParams } = new URL(request.url);
  const { items: products, nextCursor } = await agentAccess.products.listForAgent({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: parsePageLimit(searchParams.get("limit")),
    allowedOfferIds: principal.allowedOfferIds,
  });

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "GET",
    resourceType: "products",
    statusCode: 200,
    latencyMs: Date.now() - startedAt,
    outcome: "read",
  });

  return agentApiResponse(requestId, {
    products,
    nextCursor,
    rateLimit: { limit: auth.rateLimit.limit, remaining: auth.rateLimit.remaining },
  });
}
