import type { RegisterWebhookEventResult, WebhookEventRepository } from "../../../application";
import type { PaymentProviderType } from "../../../domain";
import { prisma } from "../client";
import { isUniqueConstraintViolation } from "../is-unique-constraint-violation";

export class PrismaWebhookEventRepository implements WebhookEventRepository {
  async registerIfNew(provider: PaymentProviderType, providerEventId: string): Promise<RegisterWebhookEventResult> {
    try {
      await prisma.webhookEvent.create({ data: { provider, providerEventId } });
      return "new";
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      const existing = await prisma.webhookEvent.findUnique({
        where: { provider_providerEventId: { provider, providerEventId } },
      });
      return existing?.processedAt ? "already_processed" : "retry";
    }
  }

  async markProcessed(provider: PaymentProviderType, providerEventId: string): Promise<void> {
    await prisma.webhookEvent.updateMany({
      where: { provider, providerEventId },
      data: { processedAt: new Date() },
    });
  }
}
