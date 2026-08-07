import type { PaymentRepository, UpsertPaymentInput } from "../../../application";
import { prisma } from "../client";

export class PrismaPaymentRepository implements PaymentRepository {
  async upsertByProviderReference(input: UpsertPaymentInput) {
    return prisma.payment.upsert({
      where: {
        provider_providerReference: {
          provider: input.provider,
          providerReference: input.providerReference,
        },
      },
      create: {
        orderId: input.orderId,
        provider: input.provider,
        providerReference: input.providerReference,
        status: input.status,
        amount: input.amount,
        currency: input.currency,
      },
      update: { status: input.status },
    });
  }
}
