import type { OrderRepository } from "../../../application";
import type { Order } from "../../../domain";
import { prisma } from "../client";
import { isUniqueConstraintViolation } from "../is-unique-constraint-violation";

export class PrismaOrderRepository implements OrderRepository {
  async findByCheckoutSessionId(checkoutSessionId: string) {
    return prisma.order.findUnique({ where: { checkoutSessionId } });
  }

  async createFromCheckoutSession(checkoutSessionId: string): Promise<Order> {
    const existing = await prisma.order.findUnique({ where: { checkoutSessionId } });
    if (existing) return existing;

    const checkoutSession = await prisma.checkoutSession.findUniqueOrThrow({
      where: { id: checkoutSessionId },
      include: { price: true },
    });

    try {
      return await prisma.order.create({
        data: {
          checkoutSessionId,
          customerId: checkoutSession.customerId,
          items: {
            create: {
              offerId: checkoutSession.offerId,
              priceId: checkoutSession.priceId,
              amountSnapshot: checkoutSession.price.amount,
              currencySnapshot: checkoutSession.price.currency,
            },
          },
        },
      });
    } catch (error) {
      // Carrera entre dos procesamientos concurrentes del mismo CheckoutSession:
      // el UNIQUE en checkoutSessionId ya protegió la duplicidad, solo la recuperamos.
      if (isUniqueConstraintViolation(error)) {
        return prisma.order.findUniqueOrThrow({ where: { checkoutSessionId } });
      }
      throw error;
    }
  }

  async markAsPaid(orderId: string): Promise<void> {
    await prisma.order.update({ where: { id: orderId }, data: { status: "PAID" } });
  }
}
