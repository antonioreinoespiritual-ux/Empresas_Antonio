import type { WebhookEventRepository } from "../../../application";
import type { PaymentProviderType } from "../../../domain";
import { prisma } from "../client";
import { isUniqueConstraintViolation } from "../is-unique-constraint-violation";

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
