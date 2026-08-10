import type { PreviewToken } from "../../../domain";

export interface CreatePreviewTokenRecordInput {
  pageId: string;
  tokenId: string;
  secretHash: string;
  expiresAt: Date;
  createdByApiKeyId?: string | null;
}

export interface PreviewTokenRepository {
  findByTokenId(tokenId: string): Promise<PreviewToken | null>;
  /**
   * Revoca (UPDATE revokedAt, nunca DELETE) cualquier token vigente de esta
   * Page antes de crear el nuevo, en la misma transacción — nunca coexisten
   * dos tokens de preview vigentes para la misma Page.
   */
  createReplacingActive(input: CreatePreviewTokenRecordInput): Promise<PreviewToken>;
}
