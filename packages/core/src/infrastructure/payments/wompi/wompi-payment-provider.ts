import { createHash, timingSafeEqual } from "node:crypto";
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

// Confirmado contra docs.wompi.co/en/docs/colombia/eventos/ y metodos-de-pago
// (2026-08-07): PENDING -> APPROVED | DECLINED | VOIDED | ERROR.
// VOIDED (anulación de una transacción con tarjeta antes de liquidar) se
// mapea a REFUNDED por ser lo más cercano semánticamente en nuestro enum
// interno — a confirmar contra un evento VOIDED real en sandbox.
const WOMPI_STATUS_MAP: Record<string, PaymentStatus> = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  DECLINED: "DECLINED",
  VOIDED: "REFUNDED",
  ERROR: "FAILED",
};

interface WompiTransaction {
  id: string;
  amount_in_cents: number;
  reference: string;
  currency: string;
  status: string;
}

interface WompiWebhookPayload {
  event: string;
  data: { transaction: WompiTransaction };
  sent_at: string;
  timestamp: number;
  signature: { properties: string[]; checksum: string };
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function getByPath(payload: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, payload);
}

export class WompiPaymentProvider implements PaymentProvider {
  constructor(private readonly config: WompiConfig) {}

  async preparePayment(input: PreparePaymentInput): Promise<PreparedPayment> {
    // Firma de integridad del checkout (Widget), distinta de la firma de eventos:
    // SHA256(reference + amountInCents + currency + integritySecret).
    // "reference" es nuestro propio checkoutSessionId — así el webhook puede
    // mapear la transacción de vuelta a la Order correcta (ADR-014).
    const signature = sha256Hex(
      `${input.checkoutSessionId}${input.amount}${input.currency}${this.config.integritySecret}`
    );

    return {
      provider: "WOMPI",
      clientPayload: {
        publicKey: this.config.publicKey,
        currency: input.currency,
        amountInCents: input.amount,
        reference: input.checkoutSessionId,
        signature,
      },
    };
  }

  async verifyAndParseWebhook(
    rawBody: string,
    _headers: Record<string, string>
  ): Promise<NormalizedWebhookEvent | null> {
    let payload: WompiWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return null;
    }

    const signature = payload?.signature;
    if (!signature?.properties?.length || !signature.checksum || payload.timestamp === undefined) {
      return null;
    }

    // Las rutas en signature.properties (p. ej. "transaction.id") son relativas
    // a "data" (donde vive "transaction" en el payload real de Wompi), no a la
    // raíz del payload — confirmado contra el ejemplo de docs.wompi.co/en/docs/
    // colombia/eventos/. Pendiente de reconfirmar contra un payload real capturado
    // en sandbox (ver bloqueo de credenciales).
    const concatenatedValues = signature.properties
      .map((path) => String(getByPath(payload.data, path) ?? ""))
      .join("");
    const expectedChecksum = sha256Hex(`${concatenatedValues}${payload.timestamp}${this.config.eventSecret}`);

    if (!constantTimeEquals(expectedChecksum, signature.checksum)) {
      return null;
    }

    const transaction = payload.data?.transaction;
    if (!transaction) return null;

    return {
      provider: "WOMPI",
      // Wompi no expone un event id propio (gap confirmado en su documentación):
      // se deriva de transactionId+status+timestamp, la combinación más estable
      // que Wompi garantiza — ver ADR-014.
      providerEventId: `${transaction.id}:${transaction.status}:${payload.timestamp}`,
      providerReference: transaction.id,
      checkoutSessionId: transaction.reference,
      rawStatus: transaction.status,
      amount: transaction.amount_in_cents,
      currency: transaction.currency,
    };
  }

  normalizeStatus(providerStatus: string): PaymentStatus {
    const normalized = WOMPI_STATUS_MAP[providerStatus];
    if (!normalized) {
      throw new Error(`WompiPaymentProvider: estado de transacción desconocido "${providerStatus}"`);
    }
    return normalized;
  }
}
