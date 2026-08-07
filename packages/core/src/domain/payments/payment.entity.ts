import type { PaymentProviderType } from "./payment-provider-type";
import type { PaymentStatus } from "./payment-status";

export interface Payment {
  id: string;
  orderId: string;
  provider: PaymentProviderType;
  providerReference: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  createdAt: Date;
}
