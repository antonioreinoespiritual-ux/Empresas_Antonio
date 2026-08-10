import { THEME_IDS } from "@repo/core/domain";
import { recordAgentAuditLog } from "@/lib/agent-auth";
import { agentApiResponse, requireAgentRead } from "@/lib/require-agent-access";

const THEMES_RATE_LIMIT = { limit: 60, windowMs: 60_000 };

// Catálogo estático — sin base de datos. Igual pasa por auth+scope+rate
// limit (F3: "todos detrás de withAgentAuth"), como cualquier otra ruta de
// negocio, aunque no haya ningún dato de Postgres involucrado.
export async function GET(request: Request) {
  const auth = await requireAgentRead({
    request,
    resourceType: "themes",
    routeKey: "themes:list",
    rateLimit: THEMES_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "GET",
    resourceType: "themes",
    statusCode: 200,
    latencyMs: Date.now() - startedAt,
    outcome: "read",
  });

  return agentApiResponse(requestId, { themes: THEME_IDS });
}
