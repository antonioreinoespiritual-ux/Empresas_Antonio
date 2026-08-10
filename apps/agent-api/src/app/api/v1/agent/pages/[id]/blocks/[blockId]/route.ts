import { DomainError, NotFoundError, removeBlockFromContent, updateBlockInContent } from "@repo/core/domain";
import { recordAgentAuditLog, resolveRequestId } from "@/lib/agent-auth";
import { loadLandingPageForAgentWrite } from "@/lib/agent-landing-page";
import { performAgentPageWrite } from "@/lib/agent-page-write";
import { parseIfMatch } from "@/lib/if-match";
import { agentApiResponse, requireAgentWrite } from "@/lib/require-agent-access";

const BLOCKS_WRITE_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

type Params = { params: { id: string; blockId: string } };

async function authAndLoad(request: Request, id: string, method: string, routeKey: string) {
  const ifMatch = parseIfMatch(request);
  if (ifMatch === null) {
    return { ok: false as const, response: agentApiResponse(resolveRequestId(request), { error: "missing_if_match" }, { status: 428 }) };
  }
  const auth = await requireAgentWrite({ request, method, resourceType: "pages", routeKey, rateLimit: BLOCKS_WRITE_RATE_LIMIT });
  if (!auth.ok) return { ok: false as const, response: auth.response };

  const { principal, requestId, startedAt } = auth;
  const loaded = await loadLandingPageForAgentWrite(id, principal);
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

interface UpdateBlockBody {
  patch?: unknown;
}

export async function PATCH(request: Request, { params }: Params) {
  const ctx = await authAndLoad(request, params.id, "PATCH", "pages:blocks:update");
  if (!ctx.ok) return ctx.response;
  const { principal, requestId, startedAt, page, content, ifMatch } = ctx;

  const body = (await request.json().catch(() => null)) as UpdateBlockBody | null;
  if (!body || typeof body.patch !== "object" || body.patch === null) {
    return agentApiResponse(requestId, { error: "invalid_body", detail: "patch (objeto) es requerido" }, { status: 400 });
  }

  let newContent;
  try {
    newContent = updateBlockInContent(content, params.blockId, body.patch as Record<string, unknown>);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return agentApiResponse(requestId, { error: "not_found" }, { status: 404 });
    }
    if (error instanceof DomainError) {
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
    rateLimit: BLOCKS_WRITE_RATE_LIMIT,
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
    outcome: result.status === 200 ? "block_updated" : `write_failed:${result.status}`,
  });

  return agentApiResponse(requestId, result.body, { status: result.status });
}

export async function DELETE(request: Request, { params }: Params) {
  const ctx = await authAndLoad(request, params.id, "DELETE", "pages:blocks:remove");
  if (!ctx.ok) return ctx.response;
  const { principal, requestId, startedAt, page, content, ifMatch } = ctx;

  let newContent;
  try {
    newContent = removeBlockFromContent(content, params.blockId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return agentApiResponse(requestId, { error: "not_found" }, { status: 404 });
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
    rateLimit: BLOCKS_WRITE_RATE_LIMIT,
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
    outcome: result.status === 200 ? "block_removed" : `write_failed:${result.status}`,
  });

  return agentApiResponse(requestId, result.body, { status: result.status });
}
