import type { PaymentProviderType } from "../../../domain";

/**
 * "new": primera vez que se ve este evento, seguir procesando.
 * "retry": ya existía un registro pero nunca se marcó procesado — un intento
 *   previo murió a mitad de camino (p. ej. la escritura de Order/Entitlement
 *   falló luego de registrar el evento). Como el resto del camino de
 *   escritura es idempotente, hay que reintentar el procesamiento en vez de
 *   descartarlo como duplicado, o el pago quedaría cobrado sin Order ni
 *   Entitlement.
 * "already_processed": duplicado real — no hacer nada.
 */
export type RegisterWebhookEventResult = "new" | "retry" | "already_processed";

export interface WebhookEventRepository {
  registerIfNew(provider: PaymentProviderType, providerEventId: string): Promise<RegisterWebhookEventResult>;
  markProcessed(provider: PaymentProviderType, providerEventId: string): Promise<void>;
}
