import type { PaymentProviderType } from "../payments/payment-provider-type";

export type CheckoutSessionStatus = "STARTED" | "COMPLETED" | "ABANDONED";

export interface CheckoutSession {
  id: string;
  offerId: string;
  customerId: string;
  provider: PaymentProviderType | null;
  status: CheckoutSessionStatus;
  createdAt: Date;
}
