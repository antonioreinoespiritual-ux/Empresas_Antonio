import type { Entitlement } from "../../../domain";

export interface EntitlementRepository {
  grantForOrder(orderId: string): Promise<Entitlement[]>;
}
