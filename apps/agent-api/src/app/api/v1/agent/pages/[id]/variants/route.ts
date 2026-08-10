import { randomUUID } from "node:crypto";
import { authorizeAgentAction } from "@repo/core/domain";
import { agentAccess } from "@/lib/agent-access";
import { recordAgentAuditLog } from "@/lib/agent-auth";
import { performAgentPageWrite } from "@/lib/agent-page-write";
import { agentApiResponse, requireAgentWrite } from "@/lib/require-agent-access";

const VARIANTS_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

interface CreateVariantBody {
  variantLabel?: unknown;
  variantGroupId?: unknown;
  content?: unknown;
}

/**
 * F4 — crea una variante A/B de una Page existente (misma offerId+kind,
 * variantLabel distinto — ver migración page_variant_label_unique).
 * `content` es opcional: si se omite, clona el content de la Page
 * direccionada por :id (el punto de partida más común para armar una
 * variante). No requiere If-Match — es un POST de creación, igual que
 * POST /pages, no un CAS sobre una fila existente.
 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAgentWrite({
    request,
    method: "POST",
    resourceType: "pages",
    routeKey: "pages:variants:create",
    rateLimit: VARIANTS_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const parent = await agentAccess.pages.findById(params.id);
  const visible = parent !== null && authorizeAgentAction(principal, { offerId: parent.offerId, isWrite: true }).ok;

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

  const body = (await request.json().catch(() => null)) as CreateVariantBody | null;
  if (!body || typeof body.variantLabel !== "string" || body.variantLabel.length === 0) {
    return agentApiResponse(requestId, { error: "invalid_body", detail: "variantLabel (string no vacío) es requerido" }, { status: 400 });
  }
  if (body.variantGroupId !== undefined && typeof body.variantGroupId !== "string") {
    return agentApiResponse(requestId, { error: "invalid_body", detail: "variantGroupId debe ser string si se especifica" }, { status: 400 });
  }

  const result = await performAgentPageWrite({
    request,
    principal,
    requestId,
    offerId: parent.offerId,
    kind: parent.kind,
    slug: null,
    content: body.content ?? parent.content,
    variantGroupId: (body.variantGroupId as string | undefined) ?? parent.variantGroupId ?? randomUUID(),
    variantLabel: body.variantLabel,
    rateLimit: VARIANTS_RATE_LIMIT,
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
    outcome: result.status === 201 ? "variant_created" : `write_failed:${result.status}`,
  });

  return agentApiResponse(requestId, result.body, { status: result.status });
}
