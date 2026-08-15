import { createMediaUploadUrl } from "@repo/core/application";
import { getMediaStorage } from "@/lib/media-storage";
import { recordAgentAuditLog } from "@/lib/agent-auth";
import { agentApiResponse, requireAgentWriteMedia } from "@/lib/require-agent-access";

const MEDIA_WRITE_RATE_LIMIT = { limit: 30, windowMs: 60_000 };
const VALID_KINDS = new Set(["IMAGE", "VIDEO"]);

interface UploadUrlBody {
  kind?: unknown;
  contentType?: unknown;
}

/**
 * Fase 5 del editor de landings v2 (§7) — primer paso del flujo de dos
 * pasos: devuelve una URL firmada a la que el cliente sube el binario
 * directo al storage (nunca a través de esta función serverless). Sin
 * Idempotency-Key (mismo criterio que POST /pages/:id/preview, F5 del
 * Agent Access Layer): pedir dos URLs firmadas dos veces no es dañino.
 */
export async function POST(request: Request) {
  const auth = await requireAgentWriteMedia({
    request,
    method: "POST",
    resourceType: "media",
    routeKey: "media:upload-url",
    rateLimit: MEDIA_WRITE_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const body = (await request.json().catch(() => null)) as UploadUrlBody | null;
  if (!body || typeof body.kind !== "string" || !VALID_KINDS.has(body.kind) || typeof body.contentType !== "string") {
    return agentApiResponse(
      requestId,
      { error: "invalid_body", detail: 'kind ("IMAGE"|"VIDEO") y contentType (string) son requeridos' },
      { status: 400 }
    );
  }

  const result = await createMediaUploadUrl(
    { media: getMediaStorage() },
    { kind: body.kind as "IMAGE" | "VIDEO", contentType: body.contentType }
  );

  if (!result.ok) {
    return agentApiResponse(requestId, { error: "unsupported_content_type" }, { status: 400 });
  }

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "POST",
    resourceType: "media",
    statusCode: 201,
    latencyMs: Date.now() - startedAt,
    outcome: "upload_url_issued",
  });

  return agentApiResponse(requestId, { uploadUrl: result.uploadUrl, path: result.path, expiresAt: result.expiresAt }, { status: 201 });
}
