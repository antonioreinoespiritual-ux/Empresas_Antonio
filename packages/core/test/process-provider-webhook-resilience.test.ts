import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
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
import { createFixtureOffer } from "./fixtures";
import { buildSignedWompiWebhook, TEST_WOMPI_EVENT_SECRET } from "./wompi-payload";

function makeDeps(): ProcessProviderWebhookDeps {
  return {
    providers: {
      WOMPI: new WompiPaymentProvider({
        publicKey: "pub",
        integritySecret: "secret",
        eventSecret: TEST_WOMPI_EVENT_SECRET,
      }),
      PAYPAL: new PayPalPaymentProvider({
        clientId: "",
        clientSecret: "",
        webhookId: "",
        apiBaseUrl: "https://api-m.sandbox.paypal.com",
        webBaseUrl: "https://example.com",
      }),
    },
    webhookEvents: new PrismaWebhookEventRepository(),
    orders: new PrismaOrderRepository(),
    payments: new PrismaPaymentRepository(),
    entitlements: new PrismaEntitlementRepository(),
  };
}

// Regresión de un hallazgo P1 real de revisión: si el proceso muere después
// de registrar el evento pero antes de terminar de escribir Order/Payment/
// Entitlement, un reintento del proveedor caía en la rama "duplicate" y el
// pago quedaba cobrado sin Order ni Entitlement — sin ningún registro de que
// algo salió mal.
describe("processProviderWebhook: reintento tras un fallo a mitad de camino", () => {
  it("un evento registrado pero nunca marcado como procesado se reprocesa (no se descarta como duplicado)", async () => {
    const fixture = await createFixtureOffer();
    const transactionId = `wompi-${randomUUID()}`;
    const rawBody = buildSignedWompiWebhook({
      checkoutSessionId: fixture.checkoutSession.id,
      transactionId,
      status: "APPROVED",
      amountInCents: fixture.price.amount,
      currency: fixture.price.currency,
    });

    // Simula el crash: el evento quedó registrado (como lo haría el primer
    // intento) pero nunca se llegó a escribir Order/Payment/Entitlement ni a
    // marcarlo procesado.
    await prisma.webhookEvent.create({
      data: { provider: "WOMPI", providerEventId: `${transactionId}:APPROVED:${extractTimestamp(rawBody)}` },
    });

    const result = await processProviderWebhook(makeDeps(), { provider: "WOMPI", rawBody, headers: {} });
    expect(result.outcome).toBe("processed");

    const order = await prisma.order.findUnique({ where: { checkoutSessionId: fixture.checkoutSession.id } });
    expect(order?.status).toBe("PAID");
    const entitlements = await prisma.entitlement.findMany({ where: { sourceOrderId: order!.id } });
    expect(entitlements).toHaveLength(1);
  });

  it("un evento ya marcado como procesado sí se descarta como duplicado real", async () => {
    const fixture = await createFixtureOffer();
    const transactionId = `wompi-${randomUUID()}`;
    const rawBody = buildSignedWompiWebhook({
      checkoutSessionId: fixture.checkoutSession.id,
      transactionId,
      status: "APPROVED",
      amountInCents: fixture.price.amount,
      currency: fixture.price.currency,
    });

    const first = await processProviderWebhook(makeDeps(), { provider: "WOMPI", rawBody, headers: {} });
    expect(first.outcome).toBe("processed");

    const second = await processProviderWebhook(makeDeps(), { provider: "WOMPI", rawBody, headers: {} });
    expect(second.outcome).toBe("duplicate");
  });
});

// Regresión de un hallazgo P2 real de revisión: un pago DECLINED/FAILED
// dejaba el Order en PENDING para siempre — la página de gracias solo deja
// de sondear cuando el status deja de ser PENDING.
describe("processProviderWebhook: pagos rechazados terminan el Order (no quedan en PENDING para siempre)", () => {
  it("DECLINED marca el Order como CANCELLED", async () => {
    const fixture = await createFixtureOffer();
    const rawBody = buildSignedWompiWebhook({
      checkoutSessionId: fixture.checkoutSession.id,
      transactionId: `wompi-${randomUUID()}`,
      status: "DECLINED",
      amountInCents: fixture.price.amount,
      currency: fixture.price.currency,
    });

    const result = await processProviderWebhook(makeDeps(), { provider: "WOMPI", rawBody, headers: {} });
    expect(result.outcome).toBe("processed");

    const order = await prisma.order.findUnique({ where: { checkoutSessionId: fixture.checkoutSession.id } });
    expect(order?.status).toBe("CANCELLED");
  });

  it("un DECLINED tardío (de un intento anterior) no regresa un Order ya PAID por un reintento exitoso", async () => {
    const fixture = await createFixtureOffer();
    const approvedRawBody = buildSignedWompiWebhook({
      checkoutSessionId: fixture.checkoutSession.id,
      transactionId: `wompi-${randomUUID()}`,
      status: "APPROVED",
      amountInCents: fixture.price.amount,
      currency: fixture.price.currency,
    });
    const approved = await processProviderWebhook(makeDeps(), { provider: "WOMPI", rawBody: approvedRawBody, headers: {} });
    expect(approved.outcome).toBe("processed");

    const declinedRawBody = buildSignedWompiWebhook({
      checkoutSessionId: fixture.checkoutSession.id,
      transactionId: `wompi-${randomUUID()}`,
      status: "DECLINED",
      amountInCents: fixture.price.amount,
      currency: fixture.price.currency,
    });
    const declined = await processProviderWebhook(makeDeps(), { provider: "WOMPI", rawBody: declinedRawBody, headers: {} });
    expect(declined.outcome).toBe("processed");

    const order = await prisma.order.findUnique({ where: { checkoutSessionId: fixture.checkoutSession.id } });
    expect(order?.status).toBe("PAID");
  });
});

function extractTimestamp(rawBody: string): number {
  return (JSON.parse(rawBody) as { timestamp: number }).timestamp;
}
