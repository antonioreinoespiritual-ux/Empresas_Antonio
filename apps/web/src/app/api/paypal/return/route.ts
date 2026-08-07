import { NextResponse } from "next/server";
import type { PayPalPaymentProvider } from "@repo/core/infrastructure";
import { commerce } from "@/lib/commerce";

/**
 * return_url y cancel_url del Order de PayPal (Advanced/Expanded Checkout
 * estándar, sin Card Fields — ver ADR y notas en PayPalPaymentProvider). Es
 * el único punto de la interfaz que dispara el `capture` obligatorio tras la
 * aprobación del comprador; nunca escribe Payment/Order/Entitlement — esa
 * escritura sigue siendo exclusiva del webhook real (ADR-011/013).
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("token");
  const checkoutSessionId = url.searchParams.get("checkoutSessionId");

  if (orderId && checkoutSessionId) {
    const provider = commerce.providers.PAYPAL as PayPalPaymentProvider;
    try {
      await provider.capturePayment(orderId);
    } catch (error) {
      // Comprador canceló, ya estaba capturada (doble carga de esta URL) o
      // fue rechazada de forma síncrona: el webhook real decide el estado
      // final; si nunca llega, el checkout queda PENDING como cualquier
      // intento fallido (mismo comportamiento que Wompi ante un pago no
      // confirmado).
      // eslint-disable-next-line no-console
      console.error("PayPal return: fallo al capturar", error);
    }
  }

  const destination = checkoutSessionId ? `/gracias/${checkoutSessionId}` : "/";
  return NextResponse.redirect(new URL(destination, request.url));
}
