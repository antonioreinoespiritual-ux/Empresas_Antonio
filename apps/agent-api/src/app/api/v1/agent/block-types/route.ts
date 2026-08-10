import { BLOCK_TYPE_CATALOG } from "@repo/core/domain";
import { recordAgentAuditLog } from "@/lib/agent-auth";
import { agentApiResponse, requireAgentRead } from "@/lib/require-agent-access";

const BLOCK_TYPES_RATE_LIMIT = { limit: 60, windowMs: 60_000 };

export async function GET(request: Request) {
  const auth = await requireAgentRead({
    request,
    resourceType: "block-types",
    routeKey: "block-types:list",
    rateLimit: BLOCK_TYPES_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "GET",
    resourceType: "block-types",
    statusCode: 200,
    latencyMs: Date.now() - startedAt,
    outcome: "read",
  });

  return agentApiResponse(requestId, { blockTypes: BLOCK_TYPE_CATALOG });
}
