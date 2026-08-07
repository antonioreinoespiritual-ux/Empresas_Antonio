import type { CheckoutSession, PaymentProviderType } from "../../../domain";

export interface CheckoutSessionRepository {
  create(input: { offerId: string; customerId: string }): Promise<CheckoutSession>;
  setProvider(checkoutSessionId: string, provider: PaymentProviderType): Promise<void>;
  findById(checkoutSessionId: string): Promise<CheckoutSession | null>;
}
