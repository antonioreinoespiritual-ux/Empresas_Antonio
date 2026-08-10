import { ConflictError, type LandingBlock, addBlockToContent } from "@repo/core/domain";
import { recordAgentAuditLog, resolveRequestId } from "@/lib/agent-auth";
import { loadLandingPageForAgentWrite } from "@/lib/agent-landing-page";
import { performAgentPageWrite } from "@/lib/agent-page-write";
import { parseIfMatch } from "@/lib/if-match";
import { agentApiResponse, requireAgentWrite } from "@/lib/require-agent-access";

const BLOCKS_WRITE_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

interface AddBlockBody {
  block?: unknown;
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
    routeKey: "pages:blocks:add",
    rateLimit: BLOCKS_WRITE_RATE_LIMIT,
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

  const body = (await request.json().catch(() => null)) as AddBlockBody | null;
  if (!body || typeof body.block !== "object" || body.block === null) {
    return agentApiResponse(requestId, { error: "invalid_body", detail: "block (objeto) es requerido" }, { status: 400 });
  }

  let newContent;
  try {
    newContent = addBlockToContent(loaded.content, body.block as LandingBlock);
  } catch (error) {
    if (error instanceof ConflictError) {
      return agentApiResponse(requestId, { error: "conflict", detail: error.message }, { status: 409 });
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
    rateLimit: BLOCKS_WRITE_RATE_LIMIT,
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
    outcome: result.status === 200 ? "block_added" : `write_failed:${result.status}`,
  });

  return agentApiResponse(requestId, result.body, { status: result.status });
}
