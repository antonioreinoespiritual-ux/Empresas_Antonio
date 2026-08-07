import type { CheckoutSessionRepository } from "../../../application";
import type { PaymentProviderType } from "../../../domain";
import { prisma } from "../client";

export class PrismaCheckoutSessionRepository implements CheckoutSessionRepository {
  async create(input: { offerId: string; customerId: string }) {
    return prisma.checkoutSession.create({
      data: { offerId: input.offerId, customerId: input.customerId },
    });
  }

  async setProvider(checkoutSessionId: string, provider: PaymentProviderType): Promise<void> {
    await prisma.checkoutSession.update({ where: { id: checkoutSessionId }, data: { provider } });
  }

  async findById(checkoutSessionId: string) {
    return prisma.checkoutSession.findUnique({ where: { id: checkoutSessionId } });
  }
}
