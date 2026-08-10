import { NextResponse } from "next/server";
import { authorizeAgentAction, type AgentPrincipal } from "@repo/core/domain";
import { authenticateIncomingRequest, checkRateLimit, denialStatusCode, recordAgentAuditLog, resolveRequestId, type RateLimitCheck } from "./agent-auth";

// Scope único de lectura para todos los recursos de negocio de F3 (Products,
// Offers, Pages). F1 dejó `scopes` como string[] libre sin ningún consumidor
// real; whoami (F1) no exige ninguno porque es introspección de la propia
// identidad. F3 es la primera vez que una ApiKey lee datos de negocio, así
// que es la primera vez que ese mecanismo se usa de verdad — ver
// docs/roadmap/agent-access-layer.md para la decisión completa. Ninguna
// ApiKey emitida antes de F3 tiene este scope; hay que reemitir con
// `--scopes read` (manage-agent-clients.mjs) para poder usar estas rutas.
export const READ_SCOPE = "read";

/**
 * Punto único de autenticación+autorización+rate-limit para las rutas de
 * solo lectura de F3 — mismo patrón que whoami (F1), con el chequeo de
 * scope agregado. Nunca acota por `allowedOfferIds` (instrucción explícita
 * de Antonio: la lectura de catálogo no está restringida por Offer, a
 * diferencia de lo que hará la escritura en F4).
 */
export async function requireAgentRead(params: {
  request: Request;
  resourceType: string;
  routeKey: string;
  rateLimit: { limit: number; windowMs: number };
}): Promise<
  | { ok: true; principal: AgentPrincipal; requestId: string; startedAt: number; rateLimit: RateLimitCheck }
  | { ok: false; response: NextResponse }
> {
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
        method: "GET",
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

  const authz = authorizeAgentAction(principal, { scope: READ_SCOPE, isWrite: false });
  if (!authz.ok) {
    await recordAgentAuditLog({
      requestId,
      apiClientId: principal.apiClientId,
      apiKeyId: principal.apiKeyId,
      method: "GET",
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
      method: "GET",
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

/** Respuesta 200 uniforme (headers de F1/F2) para las rutas de F3. */
export function agentReadResponse(requestId: string, body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
  });
}
