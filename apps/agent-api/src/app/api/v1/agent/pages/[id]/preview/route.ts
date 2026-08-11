import { authorizeAgentAction } from "@repo/core/domain";
import { createPreviewToken } from "@repo/core/application";
import { agentAccess } from "@/lib/agent-access";
import { recordAgentAuditLog } from "@/lib/agent-auth";
import { agentApiResponse, requireAgentPublish } from "@/lib/require-agent-access";

const PREVIEW_RATE_LIMIT = { limit: 30, windowMs: 60_000 };
// Arbitrario (F5) — suficiente para revisar una landing antes de publicarla
// sin dejar un link vivo indefinidamente. Emitir uno nuevo revoca este.
const PREVIEW_TTL_MS = 24 * 60 * 60_000;

/**
 * Funciona sin importar el status de la Page (DRAFT o PUBLISHED) — a
 * diferencia de publish/unpublish, esto no cambia ningún estado, solo
 * emite una credencial de lectura temporal. Mismo scope publish:pages que
 * publish/unpublish (F5, PLAN-AGENT-API-01).
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAgentPublish({
    request,
    method: "POST",
    resourceType: "pages",
    routeKey: "pages:preview",
    rateLimit: PREVIEW_RATE_LIMIT,
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

  const { previewToken, plaintextToken } = await createPreviewToken(
    { previewTokens: agentAccess.previewTokens, hasher: agentAccess.hasher },
    { pageId: params.id, createdByApiKeyId: principal.apiKeyId, ttlMs: PREVIEW_TTL_MS, now: new Date() }
  );

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "POST",
    resourceType: "pages",
    resourceId: params.id,
    statusCode: 201,
    latencyMs: Date.now() - startedAt,
    outcome: "preview_issued",
  });

  // `||`, no `??`: una APP_BASE_URL configurada pero vacía (string "") debe
  // caer al default igual que si no existiera — un host en blanco produce
  // una URL relativa sin scheme/host (`/preview/...`), no un error visible,
  // así que pasaba desapercibido hasta que un agente real lo reportó.
  const previewBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

  return agentApiResponse(
    requestId,
    {
      previewUrl: `${previewBaseUrl}/preview/${plaintextToken}`,
      expiresAt: previewToken.expiresAt,
    },
    { status: 201 }
  );
}
