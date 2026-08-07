import type { PaymentProviderType, PaymentStatus } from "../../../domain";

export interface PreparePaymentInput {
  checkoutSessionId: string;
  amount: number;
  currency: string;
}

export interface PreparedPayment {
  provider: PaymentProviderType;
  clientPayload: Record<string, unknown>;
}

export interface NormalizedWebhookEvent {
  provider: PaymentProviderType;
  providerEventId: string;
  providerReference: string;
  /** Nuestra propia referencia (reference/metadata que fijamos al preparar el pago), nunca inferida. */
  checkoutSessionId: string;
  rawStatus: string;
  amount: number;
  currency: string;
}

export interface PaymentProvider {
  preparePayment(input: PreparePaymentInput): Promise<PreparedPayment>;
  verifyAndParseWebhook(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<NormalizedWebhookEvent | null>;
  normalizeStatus(providerStatus: string): PaymentStatus;
}
