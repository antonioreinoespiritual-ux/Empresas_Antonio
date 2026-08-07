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
  /** https://api-m.sandbox.paypal.com en sandbox, https://api-m.paypal.com en producción. */
  apiBaseUrl: string;
}

// Confirmado contra developer.paypal.com (2026-08): a diferencia de Wompi,
// PayPal no expone un campo "status" plano en el webhook — el estado se
// deriva del nombre del evento (event_type) del recurso "capture".
const PAYPAL_EVENT_STATUS_MAP: Record<string, PaymentStatus> = {
  "PAYMENT.CAPTURE.COMPLETED": "APPROVED",
  "PAYMENT.CAPTURE.DENIED": "DECLINED",
  "PAYMENT.CAPTURE.PENDING": "PENDING",
  "PAYMENT.CAPTURE.REFUNDED": "REFUNDED",
  "PAYMENT.CAPTURE.REVERSED": "REFUNDED",
};

interface PayPalOAuthTokenResponse {
  access_token: string;
  expires_in: number;
}

export interface PayPalCaptureResult {
  captureId: string;
  status: string;
  amount: number;
  currency: string;
  checkoutSessionId: string;
}

interface PayPalWebhookCaptureResource {
  id: string;
  status: string;
  custom_id?: string;
  invoice_id?: string;
  amount?: { value: string; currency_code: string };
}

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: PayPalWebhookCaptureResource;
}

/**
 * A diferencia de Wompi (donde el Widget cobra y solo llega un webhook),
 * Advanced Checkout de PayPal exige una segunda llamada de servidor
 * (capture) después de que el cliente confirma con Card Fields. Ese paso no
 * pertenece al port genérico PaymentProvider (ningún otro proveedor lo
 * necesita) — capturePayment es específico de esta clase y lo invoca quien
 * orqueste el flujo de PayPal en la capa de interfaz.
 */
export class PayPalPaymentProvider implements PaymentProvider {
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: PayPalConfig) {}

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.value;
    }
    const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    const response = await fetch(`${this.config.apiBaseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!response.ok) {
      throw new Error(`PayPalPaymentProvider: fallo al obtener access token (${response.status})`);
    }
    const body = (await response.json()) as PayPalOAuthTokenResponse;
    this.cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
    return body.access_token;
  }

  async preparePayment(input: PreparePaymentInput): Promise<PreparedPayment> {
    const accessToken = await this.getAccessToken();
    // PayPal exige el monto como string decimal en unidad mayor de la moneda
    // (p. ej. "500.00"), no en "amount in cents" como Wompi. Asume monedas de
    // 2 decimales — no generaliza a monedas de 0 decimales (p. ej. JPY).
    const value = (input.amount / 100).toFixed(2);

    const response = await fetch(`${this.config.apiBaseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: input.checkoutSessionId,
            // custom_id es el campo documentado para datos propios que PayPal
            // repite en el recurso "capture" del webhook — reference_id no
            // está garantizado ahí. Se envían ambos por seguridad.
            custom_id: input.checkoutSessionId,
            amount: { currency_code: input.currency, value },
          },
        ],
      }),
    });

    const order = (await response.json()) as { id: string; status: string };
    if (!response.ok) {
      throw new Error(
        `PayPalPaymentProvider.preparePayment: fallo al crear la Order (${response.status}): ${JSON.stringify(order)}`
      );
    }

    return {
      provider: "PAYPAL",
      clientPayload: { orderId: order.id, clientId: this.config.clientId },
    };
  }

  /** Paso server-side obligatorio tras la confirmación de Card Fields en el cliente. */
  async capturePayment(orderId: string): Promise<PayPalCaptureResult> {
    const accessToken = await this.getAccessToken();
    const response = await fetch(`${this.config.apiBaseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    const body = (await response.json()) as {
      purchase_units: Array<{
        payments: { captures: Array<{ id: string; status: string; amount: { value: string; currency_code: string } }> };
        reference_id?: string;
        custom_id?: string;
      }>;
    };
    if (!response.ok) {
      throw new Error(`PayPalPaymentProvider.capturePayment: fallo al capturar (${response.status})`);
    }

    const purchaseUnit = body.purchase_units[0];
    const capture = purchaseUnit?.payments.captures[0];
    if (!capture) {
      throw new Error("PayPalPaymentProvider.capturePayment: respuesta sin captura");
    }

    return {
      captureId: capture.id,
      status: capture.status,
      amount: Math.round(parseFloat(capture.amount.value) * 100),
      currency: capture.amount.currency_code,
      checkoutSessionId: purchaseUnit.custom_id ?? purchaseUnit.reference_id ?? "",
    };
  }

  async verifyAndParseWebhook(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<NormalizedWebhookEvent | null> {
    let event: PayPalWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return null;
    }

    const authAlgo = headers["paypal-auth-algo"];
    const certUrl = headers["paypal-cert-url"];
    const transmissionId = headers["paypal-transmission-id"];
    const transmissionSig = headers["paypal-transmission-sig"];
    const transmissionTime = headers["paypal-transmission-time"];
    if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
      return null;
    }

    const accessToken = await this.getAccessToken();
    const verifyResponse = await fetch(`${this.config.apiBaseUrl}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: this.config.webhookId,
        webhook_event: event,
      }),
    });

    if (!verifyResponse.ok) return null;
    const verification = (await verifyResponse.json()) as { verification_status: string };
    if (verification.verification_status !== "SUCCESS") return null;

    const capture = event.resource;
    const checkoutSessionId = capture?.custom_id ?? capture?.invoice_id;
    if (!capture?.id || !checkoutSessionId || !capture.amount) return null;

    return {
      provider: "PAYPAL",
      providerEventId: event.id,
      providerReference: capture.id,
      checkoutSessionId,
      rawStatus: event.event_type,
      amount: Math.round(parseFloat(capture.amount.value) * 100),
      currency: capture.amount.currency_code,
    };
  }

  normalizeStatus(providerStatus: string): PaymentStatus {
    const normalized = PAYPAL_EVENT_STATUS_MAP[providerStatus];
    if (!normalized) {
      throw new Error(`PayPalPaymentProvider: evento desconocido "${providerStatus}"`);
    }
    return normalized;
  }
}
