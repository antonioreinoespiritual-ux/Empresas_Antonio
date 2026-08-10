import { authorizeAgentAction, parsePageContent, type AgentPrincipal, type LandingPageContent, type Page } from "@repo/core/domain";
import { agentAccess } from "./agent-access";

export type LoadLandingPageResult =
  | { ok: true; page: Page; content: LandingPageContent }
  | { ok: false; status: number; body: { error: string; detail?: string } };

/**
 * Compartido por las rutas de bloques/reorder de F4: resuelve la Page por
 * id, confirma que está dentro de allowedOfferIds (404, no 403 — mismo
 * criterio que GET/PATCH /pages/:id) y que es LANDING (los bloques no
 * aplican a CHECKOUT/THANK_YOU, esas Pages tienen un content plano).
 */
export async function loadLandingPageForAgentWrite(pageId: string, principal: AgentPrincipal): Promise<LoadLandingPageResult> {
  const page = await agentAccess.pages.findById(pageId);
  const visible = page !== null && authorizeAgentAction(principal, { offerId: page.offerId, isWrite: true }).ok;
  if (!visible) {
    return { ok: false, status: 404, body: { error: "not_found" } };
  }
  if (page.kind !== "LANDING") {
    return { ok: false, status: 400, body: { error: "invalid_kind", detail: "Las operaciones de bloques solo aplican a Pages LANDING" } };
  }
  const content = parsePageContent(page.kind, page.content) as LandingPageContent;
  return { ok: true, page, content };
}
