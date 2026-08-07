import type { EntitlementRepository } from "../../../application";
import type { Entitlement } from "../../../domain";
import { prisma } from "../client";
import { isUniqueConstraintViolation } from "../is-unique-constraint-violation";

export class PrismaEntitlementRepository implements EntitlementRepository {
  async grantForOrder(orderId: string): Promise<Entitlement[]> {
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { offer: true } } },
    });

    const productIds = [...new Set(order.items.map((item) => item.offer.productId))];

    const entitlements: Entitlement[] = [];
    for (const productId of productIds) {
      try {
        const entitlement = await prisma.entitlement.create({
          data: { customerId: order.customerId, productId, sourceOrderId: orderId },
        });
        entitlements.push(entitlement);
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          const existing = await prisma.entitlement.findUniqueOrThrow({
            where: { sourceOrderId_productId: { sourceOrderId: orderId, productId } },
          });
          entitlements.push(existing);
          continue;
        }
        throw error;
      }
    }
    return entitlements;
  }
}
