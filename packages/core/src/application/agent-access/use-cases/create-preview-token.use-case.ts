import { randomBytes } from "node:crypto";
import type { PreviewToken } from "../../../domain";
import type { ApiKeyHasher } from "../ports/api-key-crypto.port";
import type { PreviewTokenRepository } from "../ports/preview-token-repository.port";

export interface CreatePreviewTokenDeps {
  previewTokens: PreviewTokenRepository;
  /** Mismo hasher que ApiKey (SHA-256 + timingSafeEqual) — el secreto de un PreviewToken tiene la misma alta entropía. */
  hasher: ApiKeyHasher;
}

export interface CreatePreviewTokenInput {
  pageId: string;
  createdByApiKeyId?: string | null;
  ttlMs: number;
  now: Date;
}

export interface CreatePreviewTokenResult {
  previewToken: PreviewToken;
  /** "<tokenId>.<secret>" en claro — se devuelve una única vez, no se puede recuperar después. */
  plaintextToken: string;
}

/**
 * Mismo split público/secreto que ApiKey (tokenId indexado + solo el hash
 * del secreto persistido) — F5, PLAN-AGENT-API-01. Emitir uno nuevo revoca
 * cualquier token vigente de la misma Page en la misma transacción
 * (createReplacingActive) — nunca coexisten dos vigentes para una Page.
 */
export async function createPreviewToken(
  deps: CreatePreviewTokenDeps,
  input: CreatePreviewTokenInput
): Promise<CreatePreviewTokenResult> {
  const tokenId = `pt_${randomBytes(9).toString("base64url")}`;
  const secret = randomBytes(32).toString("base64url");
  const secretHash = deps.hasher.hash(secret);

  const previewToken = await deps.previewTokens.createReplacingActive({
    pageId: input.pageId,
    tokenId,
    secretHash,
    expiresAt: new Date(input.now.getTime() + input.ttlMs),
    createdByApiKeyId: input.createdByApiKeyId,
  });

  return { previewToken, plaintextToken: `${tokenId}.${secret}` };
}
