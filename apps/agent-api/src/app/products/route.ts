import { agentAccess } from "@/lib/agent-access";
import { recordAgentAuditLog } from "@/lib/agent-auth";
import { agentReadResponse, requireAgentRead } from "@/lib/require-agent-read";

// F3 — lectura de catálogo. Rate limit propio y más laxo que whoami (F1):
// un agente "moviéndose libremente" por el catálogo pagina/lista más veces
// que consulta su propia identidad; el número es arbitrario, la garantía
// atómica (F2) es lo que importa.
const PRODUCTS_LIST_RATE_LIMIT = { limit: 60, windowMs: 60_000 };

export async function GET(request: Request) {
  const auth = await requireAgentRead({
    request,
    resourceType: "products",
    routeKey: "products:list",
    rateLimit: PRODUCTS_LIST_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const products = await agentAccess.products.list();

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "GET",
    resourceType: "products",
    statusCode: 200,
    latencyMs: Date.now() - startedAt,
    outcome: "read",
  });

  return agentReadResponse(requestId, {
    products,
    rateLimit: { limit: auth.rateLimit.limit, remaining: auth.rateLimit.remaining },
  });
}
