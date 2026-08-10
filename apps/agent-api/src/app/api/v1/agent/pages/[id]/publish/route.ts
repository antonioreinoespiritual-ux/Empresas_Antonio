import { authorizeAgentAction } from "@repo/core/domain";
import { agentAccess } from "@/lib/agent-access";
import { recordAgentAuditLog } from "@/lib/agent-auth";
import { agentApiResponse, requireAgentPublish } from "@/lib/require-agent-access";

const PUBLISH_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

/**
 * F5 — idempotente por diseño: publicar una Page ya PUBLISHED es un no-op
 * 200, no un error (no hay ningún estado intermedio que "reintentar" mal).
 * Scope publish:pages, distinto de write:pages — una key puede editar
 * contenido sin poder publicarlo.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAgentPublish({
    request,
    method: "POST",
    resourceType: "pages",
    routeKey: "pages:publish",
    rateLimit: PUBLISH_RATE_LIMIT,
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
      method: "POST",
      resourceType: "pages",
      resourceId: params.id,
      statusCode: 404,
      latencyMs: Date.now() - startedAt,
      outcome: "not_found",
    });
    return agentApiResponse(requestId, { error: "not_found" }, { status: 404 });
  }

  if (page.status === "PUBLISHED") {
    return agentApiResponse(requestId, { page });
  }

  const published = await agentAccess.pages.setStatusAudited(params.id, "PUBLISHED", {
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
  });

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "POST",
    resourceType: "pages",
    resourceId: params.id,
    statusCode: 200,
    latencyMs: Date.now() - startedAt,
    outcome: "published",
  });

  return agentApiResponse(requestId, { page: published });
}
