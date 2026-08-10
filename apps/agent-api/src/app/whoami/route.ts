import { NextResponse } from "next/server";
import { authenticateIncomingRequest, denialStatusCode, recordAgentAuditLog } from "@/lib/agent-auth";

// Única ruta autenticada de F1: introspección de identidad ("¿quién soy?").
// No requiere ningún scope — cualquier ApiKey autenticada (activa, no
// revocada/expirada, de un ApiClient no suspendido) puede consultar su
// propia identidad resuelta. No toca ningún recurso de negocio (Offers,
// Pages, etc.) — eso es F2+.
export async function GET(request: Request) {
  const startedAt = Date.now();
  const { requestId, result } = await authenticateIncomingRequest(request.headers.get("authorization"));

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
    return NextResponse.json({ error: result.reason }, { status: statusCode, headers: { "Cache-Control": "no-store" } });
  }

  const { principal } = result;
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
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
