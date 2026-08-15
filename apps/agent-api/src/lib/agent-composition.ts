import type { AgentPrincipal, CompositionContent, Page } from "@repo/core/domain";
import { loadLandingPageForAgentWrite } from "./agent-landing-page";

export type LoadCompositionPageResult =
  | { ok: true; page: Page; content: CompositionContent }
  | { ok: false; status: number; body: { error: string; detail?: string } };

/**
 * Igual que `loadLandingPageForAgentWrite` (F4), más el chequeo de que el
 * content ya esté en formato Composition (`version: "composition-1"`) —
 * las rutas de nodos (Fase 3, ARCH-LANDING-EDITOR-02) no aplican a Pages
 * todavía en formato legacy/blocks. `POST /pages` (F4) sigue siendo la vía
 * para crear una Page ya en formato Composition desde el principio —
 * pasar un `content` con `version: "composition-1"` ahí ya es válido hoy
 * (parsePageContent lo reconoce desde Fase 1), sin ninguna ruta nueva.
 */
export async function loadCompositionPageForAgentWrite(pageId: string, principal: AgentPrincipal): Promise<LoadCompositionPageResult> {
  const loaded = await loadLandingPageForAgentWrite(pageId, principal);
  if (!loaded.ok) return loaded;
  if (!("version" in loaded.content) || loaded.content.version !== "composition-1") {
    return {
      ok: false,
      status: 400,
      body: { error: "invalid_content_format", detail: "Esta Page todavía no está en formato composition-1 — usar PATCH /pages/:id para migrarla" },
    };
  }
  return { ok: true, page: loaded.page, content: loaded.content };
}
