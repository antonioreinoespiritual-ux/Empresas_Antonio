import { describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { processProviderWebhook } from "../src/application";
import type { ProcessProviderWebhookDeps } from "../src/application";
import {
  PrismaOrderRepository,
  PrismaPaymentRepository,
  PrismaEntitlementRepository,
  PrismaWebhookEventRepository,
  WompiPaymentProvider,
  PayPalPaymentProvider,
} from "../src/infrastructure";
import { prisma } from "../src/infrastructure/prisma/client";

// Prueba deliberadamente NO incluida en el `pnpm test` normal ni en CI: hace
// llamadas reales a la API sandbox de Wompi con credenciales reales. Solo
// corre si se invoca explícitamente con RUN_LIVE_WOMPI_TEST=1 y variables
// WOMPI_* reales en el entorno. Documenta la única transacción sandbox real
// (id de Wompi verificable) que recorrió Payment -> Order -> Entitlement.
const shouldRun = process.env.RUN_LIVE_WOMPI_TEST === "1" && !!process.env.WOMPI_PRIVATE_KEY;

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

describe.skipIf(!shouldRun)("Wompi SANDBOX REAL: transacción real -> Payment -> Order -> Entitlement", () => {
  it("crea una transacción real en sandbox.wompi.co y la procesa con nuestro código de producción", async () => {
    const publicKey = process.env.WOMPI_PUBLIC_KEY!;
    const privateKey = process.env.WOMPI_PRIVATE_KEY!;
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET!;
    const eventSecret = process.env.WOMPI_EVENT_SECRET!;

    // 1) Fixture real en nuestra propia base de datos.
    const product = await prisma.product.create({
      data: { name: "Live Sandbox Product", type: "DIGITAL", status: "PUBLISHED" },
    });
    const offer = await prisma.offer.create({
      data: {
        productId: product.id,
        name: "Live Sandbox Offer",
        isActive: true,
        prices: { create: { amount: 5_000_000, currency: "COP", interval: "ONE_TIME" } },
      },
      include: { prices: true },
    });
    const price = offer.prices[0]!;
    const customer = await prisma.customer.create({ data: { email: `sandbox-buyer-${randomUUID()}@example.com` } });
    const checkoutSession = await prisma.checkoutSession.create({
      data: { offerId: offer.id, priceId: price.id, customerId: customer.id, provider: "WOMPI" },
    });

    // 2) Merchant real (acceptance_token de un solo uso).
    const merchantRes = await fetch(`https://sandbox.wompi.co/v1/merchants/${publicKey}`);
    const merchant = (await merchantRes.json()) as { data: { presigned_acceptance: { acceptance_token: string } } };
    const acceptanceToken = merchant.data.presigned_acceptance.acceptance_token;

    // 3) Tokenización real de una tarjeta de prueba (4242 = APPROVED documentado por Wompi).
    const tokenRes = await fetch("https://sandbox.wompi.co/v1/tokens/cards", {
      method: "POST",
      headers: { Authorization: `Bearer ${publicKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        number: "4242424242424242",
        cvc: "123",
        exp_month: "12",
        exp_year: "29",
        card_holder: "Sandbox Test",
      }),
    });
    const tokenBody = (await tokenRes.json()) as { data: { id: string } };
    const cardToken = tokenBody.data.id;

    // 4) Firma de integridad real, con la MISMA fórmula que WompiPaymentProvider.preparePayment.
    const signature = sha256Hex(`${checkoutSession.id}${price.amount}${price.currency}${integritySecret}`);

    // 5) Transacción real contra el motor de Wompi (server-to-server, sin navegador).
    const txRes = await fetch("https://sandbox.wompi.co/v1/transactions", {
      method: "POST",
      headers: { Authorization: `Bearer ${privateKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        acceptance_token: acceptanceToken,
        amount_in_cents: price.amount,
        currency: price.currency,
        signature,
        customer_email: customer.email,
        reference: checkoutSession.id,
        payment_method: { type: "CARD", token: cardToken, installments: 1 },
      }),
    });
    interface WompiTransactionData {
      id: string;
      status: string;
      amount_in_cents: number;
      reference: string;
      currency: string;
    }
    const txBody = (await txRes.json()) as { data: WompiTransactionData };
    expect(txRes.status, JSON.stringify(txBody)).toBe(201);
    const transactionId: string = txBody.data.id;

    // 6) Poll a la API real hasta que Wompi liquide la transacción.
    let finalStatus = txBody.data.status;
    let finalTransaction = txBody.data;
    for (let attempt = 0; attempt < 10 && finalStatus === "PENDING"; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const pollRes = await fetch(`https://sandbox.wompi.co/v1/transactions/${transactionId}`, {
        headers: { Authorization: `Bearer ${privateKey}` },
      });
      const pollBody = (await pollRes.json()) as { data: WompiTransactionData };
      finalStatus = pollBody.data.status;
      finalTransaction = pollBody.data;
    }
    expect(finalStatus).toBe("APPROVED");

    // 7) Construimos el webhook con los datos REALES de la transacción REAL y lo
    // firmamos con el event secret REAL — el único paso simulado es la entrega
    // HTTP (Wompi no puede alcanzar este entorno sin URL pública), no los datos.
    const timestamp = Math.floor(Date.now() / 1000);
    const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
    const envelope = {
      event: "transaction.updated",
      data: {
        transaction: {
          id: finalTransaction.id,
          amount_in_cents: finalTransaction.amount_in_cents,
          reference: finalTransaction.reference,
          currency: finalTransaction.currency,
          status: finalTransaction.status,
        },
      },
      sent_at: new Date(timestamp * 1000).toISOString(),
      timestamp,
    };
    function getByPath(obj: unknown, path: string): unknown {
      return path.split(".").reduce<unknown>((acc, key) => {
        if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
          return (acc as Record<string, unknown>)[key];
        }
        return undefined;
      }, obj);
    }
    const concatenated = properties
      .map((path) => String(getByPath(envelope.data, path) ?? ""))
      .join("");
    const checksum = sha256Hex(`${concatenated}${timestamp}${eventSecret}`);
    const rawBody = JSON.stringify({ ...envelope, signature: { properties, checksum } });

    // 8) Procesamos con el código de producción exacto (el mismo que corre la ruta /api/webhooks/wompi).
    const deps: ProcessProviderWebhookDeps = {
      providers: {
        WOMPI: new WompiPaymentProvider({ publicKey, integritySecret, eventSecret }),
        PAYPAL: new PayPalPaymentProvider({ clientId: "", clientSecret: "", webhookId: "", apiBaseUrl: "https://api-m.sandbox.paypal.com" }),
      },
      webhookEvents: new PrismaWebhookEventRepository(),
      orders: new PrismaOrderRepository(),
      payments: new PrismaPaymentRepository(),
      entitlements: new PrismaEntitlementRepository(),
    };

    const result = await processProviderWebhook(deps, { provider: "WOMPI", rawBody, headers: {} });
    expect(result.outcome).toBe("processed");

    // 9) Verificación final en base de datos real.
    const order = await prisma.order.findUnique({ where: { checkoutSessionId: checkoutSession.id } });
    expect(order?.status).toBe("PAID");

    const payment = await prisma.payment.findUnique({
      where: { provider_providerReference: { provider: "WOMPI", providerReference: transactionId } },
    });
    expect(payment?.status).toBe("APPROVED");
    expect(payment?.amount).toBe(price.amount);

    const entitlements = await prisma.entitlement.findMany({ where: { sourceOrderId: order!.id } });
    expect(entitlements).toHaveLength(1);
    expect(entitlements[0]?.productId).toBe(product.id);

    // eslint-disable-next-line no-console
    console.log("REAL WOMPI SANDBOX TRANSACTION:", transactionId, "-> Order:", order!.id, "-> Entitlement:", entitlements[0]?.id);
  });
});
