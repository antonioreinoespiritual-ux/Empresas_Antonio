import type { PaymentProviderType } from "../../../domain";
import type { EntitlementRepository } from "../../commerce/ports/entitlement-repository.port";
import type { OrderRepository } from "../../commerce/ports/order-repository.port";
import type { PaymentRepository } from "../../commerce/ports/payment-repository.port";
import type { WebhookEventRepository } from "../../commerce/ports/webhook-event-repository.port";
import type { PaymentProvider } from "../ports/payment-provider.port";

export interface ProcessProviderWebhookDeps {
  providers: Record<PaymentProviderType, PaymentProvider>;
  webhookEvents: WebhookEventRepository;
  orders: OrderRepository;
  payments: PaymentRepository;
  entitlements: EntitlementRepository;
}

export interface ProcessProviderWebhookInput {
  provider: PaymentProviderType;
  rawBody: string;
  headers: Record<string, string>;
}

export type ProcessProviderWebhookResult =
  | { outcome: "invalid_signature" }
  | { outcome: "duplicate" }
  | { outcome: "processed" };

/**
 * Camino único e idempotente de escritura para Wompi y PayPal (ADR-011/013/014):
 * 1) verificar autenticidad del evento vía el PaymentProvider correspondiente
 * 2) registrar (provider, providerEventId) — descartar si ya existía
 * 3) upsert Order por checkout_session_id, Payment por (provider, providerReference)
 * 4) otorgar Entitlements idempotentes por (order_id, product_id) si el pago fue aprobado
 * El navegador y la respuesta síncrona de capture NUNCA escriben aquí.
 */
export async function processProviderWebhook(
  deps: ProcessProviderWebhookDeps,
  input: ProcessProviderWebhookInput
): Promise<ProcessProviderWebhookResult> {
  const provider = deps.providers[input.provider];
  const event = await provider.verifyAndParseWebhook(input.rawBody, input.headers);
  if (!event) {
    return { outcome: "invalid_signature" };
  }

  const registration = await deps.webhookEvents.registerIfNew(event.provider, event.providerEventId);
  if (registration === "already_processed") {
    return { outcome: "duplicate" };
  }
  // "retry": un intento anterior registró el evento pero murió antes de
  // terminar de escribir Order/Payment/Entitlement. El resto del camino es
  // idempotente (upserts y recuperación por UNIQUE), así que reprocesar es
  // seguro y necesario — de lo contrario el pago quedaría cobrado sin Order
  // ni Entitlement, indistinguible de un duplicado real.

  const order = await deps.orders.createFromCheckoutSession(event.checkoutSessionId);
  const status = provider.normalizeStatus(event.rawStatus);

  await deps.payments.upsertByProviderReference({
    orderId: order.id,
    provider: event.provider,
    providerReference: event.providerReference,
    status,
    amount: event.amount,
    currency: event.currency,
  });

  if (status === "APPROVED") {
    await deps.orders.markAsPaid(order.id);
    // Reembolsos/contracargos posteriores (REFUNDED/PARTIALLY_REFUNDED) llegarán
    // como nuevos eventos de webhook — la revocación de Entitlements ante esos
    // casos queda fuera de este alcance (Fase 2).
    await deps.entitlements.grantForOrder(order.id);
  } else if (status === "DECLINED" || status === "FAILED") {
    // Sin esto, un pago definitivamente rechazado deja el Order en PENDING
    // para siempre: la página de gracias solo deja de sondear cuando el
    // status deja de ser PENDING, así que el comprador vería "Procesando tu
    // pago…" indefinidamente. markAsCancelled es un no-op si el Order ya
    // está PAID (p. ej. un DECLINED tardío de un intento anterior a un
    // reintento exitoso), así que nunca regresa un pago ya aprobado.
    await deps.orders.markAsCancelled(order.id);
  }

  await deps.webhookEvents.markProcessed(event.provider, event.providerEventId);

  return { outcome: "processed" };
}
