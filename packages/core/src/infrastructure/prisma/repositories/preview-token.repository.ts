import type { CreatePreviewTokenRecordInput, PreviewTokenRepository } from "../../../application/agent-access/ports/preview-token-repository.port";
import { prisma } from "../client";

export class PrismaPreviewTokenRepository implements PreviewTokenRepository {
  async findByTokenId(tokenId: string) {
    return prisma.previewToken.findUnique({ where: { tokenId } });
  }

  async createReplacingActive(input: CreatePreviewTokenRecordInput) {
    return prisma.$transaction(async (tx) => {
      // No un DELETE — un token revocado sigue existiendo para trazabilidad
      // (quién lo emitió, cuándo se cerró), igual que revokedAt en ApiKey.
      await tx.previewToken.updateMany({
        where: { pageId: input.pageId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return tx.previewToken.create({
        data: {
          pageId: input.pageId,
          tokenId: input.tokenId,
          secretHash: input.secretHash,
          expiresAt: input.expiresAt,
          createdByApiKeyId: input.createdByApiKeyId ?? null,
        },
      });
    });
  }
}
