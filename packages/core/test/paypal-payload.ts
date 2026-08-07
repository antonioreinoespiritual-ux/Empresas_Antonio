export const TEST_PAYPAL_REQUIRED_HEADERS = {
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.sandbox.paypal.com/mock-cert",
  "paypal-transmission-id": "mock-transmission-id",
  "paypal-transmission-sig": "mock-signature",
  "paypal-transmission-time": new Date().toISOString(),
};

/**
 * Construye un evento con la forma exacta documentada por PayPal
 * (id, event_type, resource.{id,status,custom_id,amount}) — usado para
 * probar processProviderWebhook con la verificación remota mockeada
 * (nivel 1: no hay forma de autofirmar un evento de PayPal como sí se puede
 * con el checksum HMAC de Wompi; PayPal firma con su propia llave privada y
 * solo su endpoint remoto puede validarlo).
 */
export function buildPayPalCaptureEvent(input: {
  eventId: string;
  eventType: "PAYMENT.CAPTURE.COMPLETED" | "PAYMENT.CAPTURE.DENIED";
  captureId: string;
  checkoutSessionId: string;
  amountInCents: number;
  currency: string;
}): string {
  return JSON.stringify({
    id: input.eventId,
    event_type: input.eventType,
    resource: {
      id: input.captureId,
      status: input.eventType === "PAYMENT.CAPTURE.COMPLETED" ? "COMPLETED" : "DECLINED",
      custom_id: input.checkoutSessionId,
      amount: { value: (input.amountInCents / 100).toFixed(2), currency_code: input.currency },
    },
  });
}
