import type { EntitlementRepository } from "../../../application";
import type { Entitlement } from "../../../domain";

export class PrismaEntitlementRepository implements EntitlementRepository {
  async grantForOrder(_orderId: string): Promise<Entitlement[]> {
    throw new Error(
      "grantForOrder: pendiente de Fase 1 (una Entitlement por OrderItem.productId, única por (order_id, product_id))"
    );
  }
}
