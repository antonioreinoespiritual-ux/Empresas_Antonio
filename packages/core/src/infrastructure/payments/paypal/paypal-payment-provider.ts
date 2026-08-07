import type {
  NormalizedWebhookEvent,
  PaymentProvider,
  PreparePaymentInput,
  PreparedPayment,
} from "../../../application";
import type { PaymentStatus } from "../../../domain";

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  webhookId: string;
}

export class PayPalPaymentProvider implements PaymentProvider {
  constructor(private readonly config: PayPalConfig) {}

  async preparePayment(_input: PreparePaymentInput): Promise<PreparedPayment> {
    // Fase 1: Orders v2 API (create), verificar elegibilidad de Advanced Credit and Debit
    // Card Payments para la cuenta/país del comercio antes de asumir disponibilidad (ADR-013).
    throw new Error("PayPalPaymentProvider.preparePayment: pendiente de Fase 1");
  }

  async verifyAndParseWebhook(
    _rawBody: string,
    _headers: Record<string, string>
  ): Promise<NormalizedWebhookEvent | null> {
    // Fase 1: verificación remota vía /v1/notifications/verify-webhook-signature;
    // confirmar el nombre exacto del evento de captura contra "Webhook event names" vigente.
    throw new Error("PayPalPaymentProvider.verifyAndParseWebhook: pendiente de Fase 1");
  }

  normalizeStatus(_providerStatus: string): PaymentStatus {
    throw new Error("PayPalPaymentProvider.normalizeStatus: pendiente de Fase 1");
  }
}
