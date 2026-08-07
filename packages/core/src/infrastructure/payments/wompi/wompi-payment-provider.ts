import type {
  NormalizedWebhookEvent,
  PaymentProvider,
  PreparePaymentInput,
  PreparedPayment,
} from "../../../application";
import type { PaymentStatus } from "../../../domain";

export interface WompiConfig {
  publicKey: string;
  integritySecret: string;
  eventSecret: string;
}

export class WompiPaymentProvider implements PaymentProvider {
  constructor(private readonly config: WompiConfig) {}

  async preparePayment(_input: PreparePaymentInput): Promise<PreparedPayment> {
    // Fase 1: confirmar Widget vs Web Checkout contra el Swagger/reference vigente (ADR-013).
    throw new Error("WompiPaymentProvider.preparePayment: pendiente de Fase 1");
  }

  async verifyAndParseWebhook(
    _rawBody: string,
    _headers: Record<string, string>
  ): Promise<NormalizedWebhookEvent | null> {
    // Fase 1: recalcular SHA256(properties + timestamp + eventSecret) y comparar con X-Event-Checksum;
    // confirmar en sandbox si sent_at es estable en reintentos antes de fijar "{transactionId}:{status}" (ADR-014).
    throw new Error("WompiPaymentProvider.verifyAndParseWebhook: pendiente de Fase 1");
  }

  normalizeStatus(_providerStatus: string): PaymentStatus {
    // Fase 1: confirmar el enum oficial de status de transacción contra el reference vigente antes de mapear.
    throw new Error("WompiPaymentProvider.normalizeStatus: pendiente de Fase 1");
  }
}
