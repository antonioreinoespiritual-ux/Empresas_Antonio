import { NextResponse } from "next/server";
import { authenticateIncomingRequest, checkRateLimit, denialStatusCode, recordAgentAuditLog, resolveRequestId } from "@/lib/agent-auth";

// Rate limit conservador para un endpoint de solo lectura sin costo real de
// negocio — el número en sí es arbitrario, lo que importa (F2) es que el
// conteo sea atómico y nunca pueda superarse bajo concurrencia real.
const WHOAMI_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

// Única ruta autenticada de F1: introspección de identidad ("¿quién soy?").
// No requiere ningún scope — cualquier ApiKey autenticada (activa, no
// revocada/expirada, de un ApiClient no suspendido) puede consultar su
// propia identidad resuelta. No toca ningún recurso de negocio (Offers,
// Pages, etc.) — eso es F3/F4.
export async function GET(request: Request) {
  const startedAt = Date.now();
  const requestId = resolveRequestId(request);
  const { result } = await authenticateIncomingRequest(request.headers.get("authorization"));

  if (!result.ok) {
    const statusCode = denialStatusCode(result.reason);
    // Solo se audita si se llegó a resolver una ApiKey — ver
    // AgentAuditLogRepository (apiClientId es NOT NULL en agent_audit_logs).
    if (result.apiClientId) {
      await recordAgentAuditLog({
        requestId,
        apiClientId: result.apiClientId,
        apiKeyId: result.apiKeyId ?? null,
        method: "GET",
        resourceType: "whoami",
        statusCode,
        latencyMs: Date.now() - startedAt,
        outcome: `denied:${result.reason}`,
      });
    }
    return NextResponse.json(
      { error: result.reason },
      { status: statusCode, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } }
    );
  }

  const { principal } = result;

  const rateLimit = await checkRateLimit({
    apiKeyId: principal.apiKeyId,
    routeKey: "whoami",
    limit: WHOAMI_RATE_LIMIT.limit,
    windowMs: WHOAMI_RATE_LIMIT.windowMs,
  });

  if (!rateLimit.allowed) {
    await recordAgentAuditLog({
      requestId,
      apiClientId: principal.apiClientId,
      apiKeyId: principal.apiKeyId,
      method: "GET",
      resourceType: "whoami",
      statusCode: 429,
      latencyMs: Date.now() - startedAt,
      outcome: "denied:rate_limited",
    });
    return NextResponse.json(
      { error: "rate_limited", limit: rateLimit.limit },
      { status: 429, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } }
    );
  }

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "GET",
    resourceType: "whoami",
    statusCode: 200,
    latencyMs: Date.now() - startedAt,
    outcome: "authenticated",
  });

  return NextResponse.json(
    {
      apiClientId: principal.apiClientId,
      apiKeyId: principal.apiKeyId,
      clientName: principal.clientName,
      scopes: principal.scopes,
      allowedOfferIds: principal.allowedOfferIds,
      forceReadOnly: principal.forceReadOnly,
      rateLimit: { limit: rateLimit.limit, remaining: rateLimit.remaining },
    },
    { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } }
  );
}
