import { agentAccess } from "@/lib/agent-access";
import { recordAgentAuditLog } from "@/lib/agent-auth";
import { agentReadResponse, requireAgentRead } from "@/lib/require-agent-read";

const PRODUCT_DETAIL_RATE_LIMIT = { limit: 120, windowMs: 60_000 };

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAgentRead({
    request,
    resourceType: "products",
    routeKey: "products:detail",
    rateLimit: PRODUCT_DETAIL_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const product = await agentAccess.products.findById(params.id);

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
    return agentReadResponse(requestId, { error: "not_found" }, { status: 404 });
  }

  return agentReadResponse(requestId, { product });
}
