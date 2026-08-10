import { NextResponse } from "next/server";
import { authorizeAgentAction, type AgentPrincipal } from "@repo/core/domain";
import { authenticateIncomingRequest, checkRateLimit, denialStatusCode, recordAgentAuditLog, resolveRequestId, type RateLimitCheck } from "./agent-auth";

// F1 dejó `scopes` como string[] libre sin ningún consumidor real — whoami
// no exige ninguno porque es introspección de la propia identidad. "read"
// (F3) fue el primer consumidor real; "write" (F4) es el segundo, para las
// mutaciones de Page. Ver docs/roadmap/agent-access-layer.md. Ninguna
// ApiKey emitida antes de F3/F4 tiene estos scopes — hay que reemitir con
// `--scopes read,write` (manage-agent-clients.mjs) según lo que necesite.
export const READ_SCOPE = "read";
export const WRITE_SCOPE = "write";
/** F5 — publicar/despublicar/emitir preview. Deliberadamente distinto de "write": una key puede editar contenido sin poder publicarlo. */
export const PUBLISH_SCOPE = "publish:pages";

interface RequireAgentAccessParams {
  request: Request;
  method: string;
  resourceType: string;
  routeKey: string;
  rateLimit: { limit: number; windowMs: number };
  scope: string;
  isWrite: boolean;
  /** Presente = la acción está acotada a una Offer puntual (allowedOfferIds). */
  offerId?: string;
}

type RequireAgentAccessResult =
  | { ok: true; principal: AgentPrincipal; requestId: string; startedAt: number; rateLimit: RateLimitCheck }
  | { ok: false; response: NextResponse };

/**
 * Punto único de autenticación+autorización+rate-limit para apps/agent-api.
 * `requireAgentRead`/`requireAgentWrite` son wrappers finos de esto con el
 * scope e isWrite ya fijados. Retrofit F3 (PLAN-AGENT-API-01): ahora sí
 * acota por `allowedOfferIds` cuando el llamador pasa `offerId` — antes
 * F3 no lo hacía (decisión revisada, ver roadmap).
 */
export async function requireAgentAccess(params: RequireAgentAccessParams): Promise<RequireAgentAccessResult> {
  const startedAt = Date.now();
  const requestId = resolveRequestId(params.request);
  const { result } = await authenticateIncomingRequest(params.request.headers.get("authorization"));

  if (!result.ok) {
    const statusCode = denialStatusCode(result.reason);
    if (result.apiClientId) {
      await recordAgentAuditLog({
        requestId,
        apiClientId: result.apiClientId,
        apiKeyId: result.apiKeyId ?? null,
        method: params.method,
        resourceType: params.resourceType,
        statusCode,
        latencyMs: Date.now() - startedAt,
        outcome: `denied:${result.reason}`,
      });
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: result.reason },
        { status: statusCode, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } }
      ),
    };
  }

  const { principal } = result;

  const authz = authorizeAgentAction(principal, { scope: params.scope, isWrite: params.isWrite, offerId: params.offerId });
  if (!authz.ok) {
    await recordAgentAuditLog({
      requestId,
      apiClientId: principal.apiClientId,
      apiKeyId: principal.apiKeyId,
      method: params.method,
      resourceType: params.resourceType,
      statusCode: denialStatusCode(authz.reason),
      latencyMs: Date.now() - startedAt,
      outcome: `denied:${authz.reason}`,
    });
    return {
      ok: false,
      response: NextResponse.json(
        { error: authz.reason },
        { status: denialStatusCode(authz.reason), headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } }
      ),
    };
  }

  const rateLimit = await checkRateLimit({
    apiKeyId: principal.apiKeyId,
    routeKey: params.routeKey,
    limit: params.rateLimit.limit,
    windowMs: params.rateLimit.windowMs,
  });

  if (!rateLimit.allowed) {
    await recordAgentAuditLog({
      requestId,
      apiClientId: principal.apiClientId,
      apiKeyId: principal.apiKeyId,
      method: params.method,
      resourceType: params.resourceType,
      statusCode: 429,
      latencyMs: Date.now() - startedAt,
      outcome: "denied:rate_limited",
    });
    return {
      ok: false,
      response: NextResponse.json(
        { error: "rate_limited", limit: rateLimit.limit },
        { status: 429, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } }
      ),
    };
  }

  return { ok: true, principal, requestId, startedAt, rateLimit };
}

export function requireAgentRead(params: {
  request: Request;
  resourceType: string;
  routeKey: string;
  rateLimit: { limit: number; windowMs: number };
  offerId?: string;
}): Promise<RequireAgentAccessResult> {
  return requireAgentAccess({ ...params, method: "GET", scope: READ_SCOPE, isWrite: false });
}

export function requireAgentWrite(params: {
  request: Request;
  method: string;
  resourceType: string;
  routeKey: string;
  rateLimit: { limit: number; windowMs: number };
  offerId?: string;
}): Promise<RequireAgentAccessResult> {
  return requireAgentAccess({ ...params, scope: WRITE_SCOPE, isWrite: true });
}

export function requireAgentPublish(params: {
  request: Request;
  method: string;
  resourceType: string;
  routeKey: string;
  rateLimit: { limit: number; windowMs: number };
  offerId?: string;
}): Promise<RequireAgentAccessResult> {
  return requireAgentAccess({ ...params, scope: PUBLISH_SCOPE, isWrite: true });
}

/** Respuesta uniforme (headers de F1/F2) para las rutas de apps/agent-api. */
export function agentApiResponse(requestId: string, body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
  });
}
