export type EntitlementStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

export interface Entitlement {
  id: string;
  customerId: string;
  productId: string;
  sourceOrderId: string;
  status: EntitlementStatus;
  expiresAt: Date | null;
}
