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

/**
 * Camino único e idempotente de escritura para Wompi y PayPal, ADR-013/ADR-014:
 * 1) verificar autenticidad del evento vía el PaymentProvider correspondiente
 * 2) registrar (provider, providerEventId) — descartar si ya existía
 * 3) upsert Order por checkout_session_id, Payment por (provider, providerReference)
 * 4) otorgar Entitlements idempotentes por (order_id, product_id)
 * El navegador y la respuesta síncrona de capture NUNCA escriben aquí.
 */
export async function processProviderWebhook(
  _deps: ProcessProviderWebhookDeps,
  _input: ProcessProviderWebhookInput
) {
  throw new Error("processProviderWebhook: pendiente de Fase 1");
}
