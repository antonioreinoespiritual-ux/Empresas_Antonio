import { NextResponse } from "next/server";
import { processProviderWebhook } from "@repo/core/application";
import { commerce } from "@/lib/commerce";

// ADR-011/ADR-013: única entrada de eventos de PayPal. PayPalPaymentProvider
// sigue pendiente de Fase 1 (verify-webhook-signature y nombres de evento se
// confirman contra la documentación vigente antes de implementarlo) — esta
// ruta ya deja cableada la orquestación idempotente para cuando eso esté listo.
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  const result = await processProviderWebhook(commerce, {
    provider: "PAYPAL",
    rawBody,
    headers,
  });

  if (result.outcome === "invalid_signature") {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  return NextResponse.json({ received: true });
}
