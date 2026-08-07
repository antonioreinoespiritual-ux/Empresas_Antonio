import type { Payment, PaymentProviderType, PaymentStatus } from "../../../domain";

export interface UpsertPaymentInput {
  orderId: string;
  provider: PaymentProviderType;
  providerReference: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
}

export interface PaymentRepository {
  upsertByProviderReference(input: UpsertPaymentInput): Promise<Payment>;
}
