import type { PageKind } from "@repo/core/domain";
import { agentAccess } from "@/lib/agent-access";
import { recordAgentAuditLog } from "@/lib/agent-auth";
import { agentReadResponse, requireAgentRead } from "@/lib/require-agent-read";

const PAGES_READ_RATE_LIMIT = { limit: 60, windowMs: 60_000 };

const PAGE_KINDS: readonly PageKind[] = ["LANDING", "CHECKOUT", "THANK_YOU"];

function isPageKind(value: string): value is PageKind {
  return (PAGE_KINDS as readonly string[]).includes(value);
}

// PageRepository (F0/F2) solo tiene lookup puntual por (offerId, kind) —
// nunca existió un "listar todas las Pages", y no se agrega acá: PageKind
// tiene 3 valores fijos y offerId ya se obtiene de GET /offers, así que un
// agente puede enumerar las páginas de una Offer sin necesitar un endpoint
// de listado nuevo.
export async function GET(request: Request) {
  const auth = await requireAgentRead({
    request,
    resourceType: "pages",
    routeKey: "pages:read",
    rateLimit: PAGES_READ_RATE_LIMIT,
  });
  if (!auth.ok) return auth.response;

  const { principal, requestId, startedAt } = auth;
  const { searchParams } = new URL(request.url);
  const offerId = searchParams.get("offerId");
  const kind = searchParams.get("kind");

  if (!offerId || !kind || !isPageKind(kind)) {
    return agentReadResponse(
      requestId,
      { error: "invalid_query", detail: `offerId es requerido y kind debe ser uno de: ${PAGE_KINDS.join(", ")}` },
      { status: 400 }
    );
  }

  const page = await agentAccess.pages.findByOfferAndKind(offerId, kind);

  await recordAgentAuditLog({
    requestId,
    apiClientId: principal.apiClientId,
    apiKeyId: principal.apiKeyId,
    method: "GET",
    resourceType: "pages",
    resourceId: page?.id ?? null,
    statusCode: page ? 200 : 404,
    latencyMs: Date.now() - startedAt,
    outcome: page ? "read" : "not_found",
  });

  if (!page) {
    return agentReadResponse(requestId, { error: "not_found" }, { status: 404 });
  }

  return agentReadResponse(requestId, { page });
}
