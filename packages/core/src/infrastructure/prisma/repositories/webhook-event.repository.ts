import type { WebhookEventRepository } from "../../../application";
import type { PaymentProviderType } from "../../../domain";
import { prisma } from "../client";

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = "P2002";

export class PrismaWebhookEventRepository implements WebhookEventRepository {
  async registerIfNew(provider: PaymentProviderType, providerEventId: string): Promise<boolean> {
    try {
      await prisma.webhookEvent.create({ data: { provider, providerEventId } });
      return true;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  async markProcessed(provider: PaymentProviderType, providerEventId: string): Promise<void> {
    await prisma.webhookEvent.updateMany({
      where: { provider, providerEventId },
      data: { processedAt: new Date() },
    });
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
  );
}
