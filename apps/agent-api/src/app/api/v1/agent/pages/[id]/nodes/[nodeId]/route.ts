import { ZodError } from "zod";
import { DomainError, NotFoundError, removeNodeFromComposition, updateNodeInComposition } from "@repo/core/domain";
import { recordAgentAuditLog, resolveRequestId } from "@/lib/agent-auth";
import { loadCompositionPageForAgentWrite } from "@/lib/agent-composition";
import { performAgentPageWrite } from "@/lib/agent-page-write";
import { parseIfMatch } from "@/lib/if-match";
import { agentApiResponse, requireAgentWrite } from "@/lib/require-agent-access";

const NODES_WRITE_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

type Params = { params: { id: string; nodeId: string } };

async function authAndLoad(request: Request, id: string, method: string, routeKey: string) {
  const ifMatch = parseIfMatch(request);
  if (ifMatch === null) {
    return { ok: false as const, response: agentApiResponse(resolveRequestId(request), { error: "missing_if_match" }, { status: 428 }) };
  }
  const auth = await requireAgentWrite({ request, method, resourceType: "pages", routeKey, rateLimit: NODES_WRITE_RATE_LIMIT });
  if (!auth.ok) return { ok: false as const, response: auth.response };

  const { principal, requestId, startedAt } = auth;
  const loaded = await loadCompositionPageForAgentWrite(id, principal);
  if (!loaded.ok) {
    await recordAgentAuditLog({
      requestId,
      apiClientId: principal.apiClientId,
      apiKeyId: principal.apiKeyId,
      method,
      resourceType: "pages",
      resourceId: id,
      statusCode: loaded.status,
      latencyMs: Date.now() - startedAt,
      outcome: `denied:${loaded.body.error}`,
    });
    return { ok: false as const, response: agentApiResponse(requestId, loaded.body, { status: loaded.status }) };
  }

  return { ok: true as const, ifMatch, principal, requestId, startedAt, page: loaded.page, content: loaded.content };
}

const PATCH_ALLOWED_KEYS = new Set(["content", "style"]);

interface UpdateNodeBody {
  patch?: Record<string, unknown>;
}

export async function PATCH(request: Request, { params }: Params) {
  const ctx = await authAndLoad(request, params.id, "PATCH", "pages:nodes:update");
  if (!ctx.ok) return ctx.response;
  const { principal, requestId, startedAt, page, content, ifMatch } = ctx;

  const body = (await request.json().catch(() => null)) as UpdateNodeBody | null;
  const patchKeys = body && typeof body.patch === "object" && body.patch !== null ? Object.keys(body.patch) : null;
  if (!patchKeys || patchKeys.length === 0 || !patchKeys.every((key) => PATCH_ALLOWED_KEYS.has(key))) {
    return agentApiResponse(
      requestId,
      { error: "invalid_body", detail: "patch solo admite content/style — cambiar type/id/children de un nodo requiere remove + add" },
      { status: 400 }
    );
  }

  let newContent;
  try {
    newContent = updateNodeInComposition(content, params.nodeId, body!.patch as { content?: unknown; style?: unknown });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return agentApiResponse(requestId, { error: "not_found" }, { status: 404 });
    }
    if (error instanceof DomainError || error instanceof ZodError) {
      return agentApiResponse(requestId, { error: "invalid_patch", detail: error.message }, { status: 400 });
    }
    throw error;
  }

  const result = await performAgentPageWrite({
    request,
    principal,
    requestId,
    offerId: page.offerId,
    kind: page.kind,
    slug: page.slug,
    content: newContent,
    expectedVersion: ifMatch,
    variantLabel: page.variantLabel,
    rateLimit: NODES_WRITE_RATE_LIMIT,
  });

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "PATCH",
    resourceType: "pages",
    resourceId: params.id,
    statusCode: result.status,
    latencyMs: Date.now() - startedAt,
    outcome: result.status === 200 ? "node_updated" : `write_failed:${result.status}`,
  });

  return agentApiResponse(requestId, result.body, { status: result.status });
}

export async function DELETE(request: Request, { params }: Params) {
  const ctx = await authAndLoad(request, params.id, "DELETE", "pages:nodes:remove");
  if (!ctx.ok) return ctx.response;
  const { principal, requestId, startedAt, page, content, ifMatch } = ctx;

  let newContent;
  try {
    newContent = removeNodeFromComposition(content, params.nodeId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return agentApiResponse(requestId, { error: "not_found" }, { status: 404 });
    }
    if (error instanceof DomainError || error instanceof ZodError) {
      return agentApiResponse(requestId, { error: "invalid_removal", detail: error.message }, { status: 400 });
    }
    throw error;
  }

  const result = await performAgentPageWrite({
    request,
    principal,
    requestId,
    offerId: page.offerId,
    kind: page.kind,
    slug: page.slug,
    content: newContent,
    expectedVersion: ifMatch,
    variantLabel: page.variantLabel,
    rateLimit: NODES_WRITE_RATE_LIMIT,
  });

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "DELETE",
    resourceType: "pages",
    resourceId: params.id,
    statusCode: result.status,
    latencyMs: Date.now() - startedAt,
    outcome: result.status === 200 ? "node_removed" : `write_failed:${result.status}`,
  });

  return agentApiResponse(requestId, result.body, { status: result.status });
}
