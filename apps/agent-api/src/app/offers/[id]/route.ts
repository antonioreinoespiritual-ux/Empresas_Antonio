import { agentAccess } from "@/lib/agent-access";
import { recordAgentAuditLog } from "@/lib/agent-auth";
import { agentReadResponse, requireAgentRead } from "@/lib/require-agent-read";

const OFFER_DETAIL_RATE_LIMIT = { limit: 120, windowMs: 60_000 };

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAgentRead({
    request,
    resourceType: "offers",
    routeKey: "offers:detail",
    rateLimit: OFFER_DETAIL_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const offer = await agentAccess.offers.findById(params.id);

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "GET",
    resourceType: "offers",
    resourceId: params.id,
    statusCode: offer ? 200 : 404,
    latencyMs: Date.now() - startedAt,
    outcome: offer ? "read" : "not_found",
  });

  if (!offer) {
    return agentReadResponse(requestId, { error: "not_found" }, { status: 404 });
  }

  return agentReadResponse(requestId, { offer });
}
