import { ZodError } from "zod";
import { addNodeToComposition, COMPOSITION_ROOT_ID, ConflictError, DomainError, NotFoundError } from "@repo/core/domain";
import { recordAgentAuditLog, resolveRequestId } from "@/lib/agent-auth";
import { loadCompositionPageForAgentWrite } from "@/lib/agent-composition";
import { performAgentPageWrite } from "@/lib/agent-page-write";
import { parseIfMatch } from "@/lib/if-match";
import { agentApiResponse, requireAgentWrite } from "@/lib/require-agent-access";

const NODES_WRITE_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

interface AddNodeBody {
  /** Contenedor donde se agrega — omitido o COMPOSITION_ROOT_ID = section nueva al nivel más alto (ARCH-LANDING-EDITOR-02 Fase 3). */
  parentNodeId?: unknown;
  node?: unknown;
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
    routeKey: "pages:nodes:add",
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

  const body = (await request.json().catch(() => null)) as AddNodeBody | null;
  if (!body || typeof body.node !== "object" || body.node === null) {
    return agentApiResponse(requestId, { error: "invalid_body", detail: "node (objeto) es requerido" }, { status: 400 });
  }
  const parentNodeId = typeof body.parentNodeId === "string" ? body.parentNodeId : COMPOSITION_ROOT_ID;

  let newContent;
  try {
    newContent = addNodeToComposition(loaded.content, parentNodeId, body.node);
  } catch (error) {
    if (error instanceof ConflictError) {
      return agentApiResponse(requestId, { error: "conflict", detail: error.message }, { status: 409 });
    }
    if (error instanceof NotFoundError) {
      return agentApiResponse(requestId, { error: "not_found", detail: error.message }, { status: 404 });
    }
    if (error instanceof DomainError || error instanceof ZodError) {
      return agentApiResponse(requestId, { error: "invalid_node", detail: error.message }, { status: 400 });
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
    outcome: result.status === 200 ? "node_added" : `write_failed:${result.status}`,
  });

  return agentApiResponse(requestId, result.body, { status: result.status });
}
