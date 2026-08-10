import { isPreviewTokenUsable, parsePreviewToken } from "../../../domain";
import type { Page } from "../../../domain";
import type { PageRepository } from "../../content/ports/page-repository.port";
import type { ApiKeyHasher } from "../ports/api-key-crypto.port";
import type { PreviewTokenRepository } from "../ports/preview-token-repository.port";

export interface VerifyPreviewTokenDeps {
  previewTokens: PreviewTokenRepository;
  pages: PageRepository;
  hasher: ApiKeyHasher;
}

export type VerifyPreviewTokenResult = { ok: true; page: Page } | { ok: false; reason: "invalid" | "expired_or_revoked" };

/**
 * Nunca distingue en la respuesta "token no existe" de "secreto no
 * coincide" — ambos son "invalid", mismo criterio que
 * authenticateAgentRequest para no permitir enumerar tokenId válidos
 * probando secretos al azar.
 */
export async function verifyPreviewToken(deps: VerifyPreviewTokenDeps, raw: string | null | undefined, now: Date): Promise<VerifyPreviewTokenResult> {
  const parsed = parsePreviewToken(raw);
  if (!parsed) return { ok: false, reason: "invalid" };

  const token = await deps.previewTokens.findByTokenId(parsed.tokenId);
  if (!token || !deps.hasher.verify(parsed.secret, token.secretHash)) {
    return { ok: false, reason: "invalid" };
  }

  if (!isPreviewTokenUsable(token, now)) {
    return { ok: false, reason: "expired_or_revoked" };
  }

  const page = await deps.pages.findById(token.pageId);
  if (!page) {
    // Invariante violado (FK pageId -> Page) — no una denegación normal, ver authenticateAgentRequest.
    throw new Error(`PreviewToken ${token.id} referencia una Page inexistente (${token.pageId})`);
  }

  return { ok: true, page };
}
