import { registerAsset } from "@repo/core/application";
import { agentAccess } from "@/lib/agent-access";
import { getMediaStorage } from "@/lib/media-storage";
import { recordAgentAuditLog } from "@/lib/agent-auth";
import { parsePageLimit } from "@/lib/pagination";
import { agentApiResponse, requireAgentRead, requireAgentWriteMedia } from "@/lib/require-agent-access";

const MEDIA_WRITE_RATE_LIMIT = { limit: 30, windowMs: 60_000 };
const MEDIA_LIST_RATE_LIMIT = { limit: 60, windowMs: 60_000 };
const VALID_KINDS = new Set(["IMAGE", "VIDEO"]);
// Mismo shape que genera createMediaUploadUrl ("image/<32 hex>.<ext>") —
// nunca un path arbitrario que el cliente pueda inventar (defensa en
// profundidad; publicUrlFor por sí solo ya nunca sale del bucket propio).
const PATH_SHAPE = /^(image|video)\/[0-9a-f]{32}\.[a-z0-9]+$/;

interface RegisterAssetBody {
  kind?: unknown;
  path?: unknown;
  width?: unknown;
  height?: unknown;
  altText?: unknown;
}

function isNullableFiniteNumber(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || (typeof value === "number" && Number.isFinite(value) && value > 0);
}

/**
 * Fase 5 del editor de landings v2 (§7) — segundo paso: registra el Asset
 * ya subido al storage. Sin Idempotency-Key (mismo criterio que
 * POST /pages/:id/preview) — un doble registro accidental no es dañino,
 * solo dos filas apuntando al mismo binario.
 */
export async function POST(request: Request) {
  const auth = await requireAgentWriteMedia({
    request,
    method: "POST",
    resourceType: "media",
    routeKey: "media:assets:create",
    rateLimit: MEDIA_WRITE_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const body = (await request.json().catch(() => null)) as RegisterAssetBody | null;
  const valid =
    body &&
    typeof body.kind === "string" &&
    VALID_KINDS.has(body.kind) &&
    typeof body.path === "string" &&
    PATH_SHAPE.test(body.path) &&
    typeof body.altText === "string" &&
    body.altText.length > 0 &&
    isNullableFiniteNumber(body.width) &&
    isNullableFiniteNumber(body.height);

  if (!valid) {
    return agentApiResponse(
      requestId,
      { error: "invalid_body", detail: "kind, path (de createMediaUploadUrl) y altText son requeridos; width/height opcionales deben ser > 0" },
      { status: 400 }
    );
  }

  const asset = await registerAsset(
    { assets: agentAccess.assets, media: getMediaStorage() },
    {
      kind: body!.kind as "IMAGE" | "VIDEO",
      path: body!.path as string,
      width: (body!.width as number | null | undefined) ?? null,
      height: (body!.height as number | null | undefined) ?? null,
      altText: body!.altText as string,
    }
  );

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "POST",
    resourceType: "media",
    resourceId: asset.id,
    statusCode: 201,
    latencyMs: Date.now() - startedAt,
    outcome: "asset_registered",
  });

  return agentApiResponse(requestId, { asset }, { status: 201 });
}

export async function GET(request: Request) {
  const auth = await requireAgentRead({
    request,
    resourceType: "media",
    routeKey: "media:assets:list",
    rateLimit: MEDIA_LIST_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const { searchParams } = new URL(request.url);
  const { items: assets, nextCursor } = await agentAccess.assets.list({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: parsePageLimit(searchParams.get("limit")),
  });

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "GET",
    resourceType: "media",
    statusCode: 200,
    latencyMs: Date.now() - startedAt,
    outcome: "read",
  });

  return agentApiResponse(requestId, {
    assets,
    nextCursor,
    rateLimit: { limit: auth.rateLimit.limit, remaining: auth.rateLimit.remaining },
  });
}
