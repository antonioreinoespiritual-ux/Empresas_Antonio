// ADR-011/ADR-013: única entrada de eventos de PayPal. La lógica de verificación +
// procesamiento idempotente se implementa en Fase 1 (PayPalPaymentProvider + processProviderWebhook).
export async function POST(): Promise<Response> {
  return new Response("not implemented — Fase 1", { status: 501 });
}
