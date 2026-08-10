import { DomainError, NotFoundError, reorderBlocksInContent } from "@repo/core/domain";
import { recordAgentAuditLog, resolveRequestId } from "@/lib/agent-auth";
import { loadLandingPageForAgentWrite } from "@/lib/agent-landing-page";
import { performAgentPageWrite } from "@/lib/agent-page-write";
import { parseIfMatch } from "@/lib/if-match";
import { agentApiResponse, requireAgentWrite } from "@/lib/require-agent-access";

const REORDER_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

interface ReorderBody {
  orderedBlockIds?: unknown;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ifMatch = parseIfMatch(request);
  if (ifMatch === null) {
    return agentApiResponse(resolveRequestId(request), { error: "missing_if_match" }, { status: 428 });
  }

  const auth = await requireAgentWrite({
    request,
    method: "POST",
    resourceType: "pages",
    routeKey: "pages:reorder",
    rateLimit: REORDER_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const loaded = await loadLandingPageForAgentWrite(params.id, principal);
  if (!loaded.ok) {
    await recordAgentAuditLog({
      requestId,
      apiClientId: principal.apiClientId,
      apiKeyId: principal.apiKeyId,
      method: "POST",
      resourceType: "pages",
      resourceId: params.id,
      statusCode: loaded.status,
      latencyMs: Date.now() - startedAt,
      outcome: `denied:${loaded.body.error}`,
    });
    return agentApiResponse(requestId, loaded.body, { status: loaded.status });
  }

  const body = (await request.json().catch(() => null)) as ReorderBody | null;
  if (!body || !Array.isArray(body.orderedBlockIds) || !body.orderedBlockIds.every((id) => typeof id === "string")) {
    return agentApiResponse(requestId, { error: "invalid_body", detail: "orderedBlockIds (string[]) es requerido" }, { status: 400 });
  }

  let newContent;
  try {
    newContent = reorderBlocksInContent(loaded.content, body.orderedBlockIds as string[]);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return agentApiResponse(requestId, { error: "not_found" }, { status: 404 });
    }
    if (error instanceof DomainError) {
      return agentApiResponse(requestId, { error: "invalid_order", detail: error.message }, { status: 400 });
    }
    throw error;
  }

  const result = await performAgentPageWrite({
    request,
    principal,
    requestId,
    offerId: loaded.page.offerId,
    kind: loaded.page.kind,
    slug: loaded.page.slug,
    content: newContent,
    expectedVersion: ifMatch,
    variantLabel: loaded.page.variantLabel,
    rateLimit: REORDER_RATE_LIMIT,
  });

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "POST",
    resourceType: "pages",
    resourceId: params.id,
    statusCode: result.status,
    latencyMs: Date.now() - startedAt,
    outcome: result.status === 200 ? "reordered" : `write_failed:${result.status}`,
  });

  return agentApiResponse(requestId, result.body, { status: result.status });
}
