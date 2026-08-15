import { COMPOSITION_ROOT_ID, DomainError, NotFoundError, reorderChildrenInComposition } from "@repo/core/domain";
import { recordAgentAuditLog, resolveRequestId } from "@/lib/agent-auth";
import { loadCompositionPageForAgentWrite } from "@/lib/agent-composition";
import { performAgentPageWrite } from "@/lib/agent-page-write";
import { parseIfMatch } from "@/lib/if-match";
import { agentApiResponse, requireAgentWrite } from "@/lib/require-agent-access";

const NODES_WRITE_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

interface ReorderNodesBody {
  /** Contenedor a reordenar — omitido o COMPOSITION_ROOT_ID = las sections del nivel más alto. */
  parentNodeId?: unknown;
  orderedNodeIds?: unknown;
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
    routeKey: "pages:nodes:reorder",
    rateLimit: NODES_WRITE_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const loaded = await loadCompositionPageForAgentWrite(params.id, principal);
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

  const body = (await request.json().catch(() => null)) as ReorderNodesBody | null;
  if (!body || !Array.isArray(body.orderedNodeIds) || !body.orderedNodeIds.every((id) => typeof id === "string")) {
    return agentApiResponse(requestId, { error: "invalid_body", detail: "orderedNodeIds (string[]) es requerido" }, { status: 400 });
  }
  const parentNodeId = typeof body.parentNodeId === "string" ? body.parentNodeId : COMPOSITION_ROOT_ID;

  let newContent;
  try {
    newContent = reorderChildrenInComposition(loaded.content, parentNodeId, body.orderedNodeIds as string[]);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return agentApiResponse(requestId, { error: "not_found", detail: error.message }, { status: 404 });
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
    rateLimit: NODES_WRITE_RATE_LIMIT,
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
    outcome: result.status === 200 ? "nodes_reordered" : `write_failed:${result.status}`,
  });

  return agentApiResponse(requestId, result.body, { status: result.status });
}
