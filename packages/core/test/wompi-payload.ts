import { createHash } from "node:crypto";

// Debe coincidir con el eventSecret configurado en el WompiPaymentProvider
// bajo prueba — ambos simulan el "secreto compartido" que en producción solo
// conocen el comercio y Wompi.
export const TEST_WOMPI_EVENT_SECRET = "test_events_secret_local";

type WompiTestStatus = "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Construye y firma correctamente un payload con la forma exacta documentada
 * por Wompi (docs.wompi.co/en/docs/colombia/eventos/), replicando el mismo
 * algoritmo de checksum que WompiPaymentProvider.verifyAndParseWebhook espera
 * verificar. Esto ejercita nuestro código de verificación real contra un
 * payload real, sin necesitar que Wompi lo envíe de verdad.
 */
export function buildSignedWompiWebhook(input: {
  checkoutSessionId: string;
  transactionId: string;
  status: WompiTestStatus;
  amountInCents: number;
  currency: string;
  timestamp?: number;
  eventSecret?: string;
}): string {
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];

  const envelope = {
    event: "transaction.updated",
    data: {
      transaction: {
        id: input.transactionId,
        amount_in_cents: input.amountInCents,
        reference: input.checkoutSessionId,
        currency: input.currency,
        status: input.status,
      },
    },
    sent_at: new Date(timestamp * 1000).toISOString(),
    timestamp,
  };

  const concatenatedValues = properties.map((path) => String(getByPath(envelope.data, path) ?? "")).join("");
  const checksum = sha256Hex(`${concatenatedValues}${timestamp}${input.eventSecret ?? TEST_WOMPI_EVENT_SECRET}`);

  return JSON.stringify({ ...envelope, signature: { properties, checksum } });
}
