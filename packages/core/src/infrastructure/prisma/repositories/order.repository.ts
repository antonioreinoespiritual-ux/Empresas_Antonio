import type { OrderRepository } from "../../../application";
import type { Order } from "../../../domain";
import { prisma } from "../client";

export class PrismaOrderRepository implements OrderRepository {
  async findByCheckoutSessionId(checkoutSessionId: string) {
    return prisma.order.findUnique({ where: { checkoutSessionId } });
  }

  async createFromCheckoutSession(_checkoutSessionId: string): Promise<Order> {
    throw new Error(
      "createFromCheckoutSession: pendiente de Fase 1 (requiere snapshot de Offer/Price en OrderItem)"
    );
  }
}
