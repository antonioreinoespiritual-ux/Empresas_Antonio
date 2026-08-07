import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
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
import { buildPayPalCaptureEvent, TEST_PAYPAL_REQUIRED_HEADERS } from "./paypal-payload";

// NIVEL 1 (unit/mocks de red): a diferencia de Wompi, la firma de PayPal es
// asimétrica y solo su endpoint remoto puede validarla — no hay forma de
// autofirmar un evento "de verdad" sin una entrega real. Por eso aquí se
// mockea exclusivamente la llamada HTTP a PayPal (OAuth + verify-webhook-
// signature); la base de datos sigue siendo Postgres real, sin mocks.
function mockPayPalFetch(verificationStatus: "SUCCESS" | "FAILURE") {
  return vi.fn(async (input: string | URL | Request) => {
    const url = input.toString();
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "mock-access-token", expires_in: 3600 }), { status: 200 });
    }
    if (url.endsWith("/v1/notifications/verify-webhook-signature")) {
      return new Response(JSON.stringify({ verification_status: verificationStatus }), { status: 200 });
    }
    throw new Error(`mockPayPalFetch: URL no esperada en este test: ${url}`);
  });
}

function makeDeps(): ProcessProviderWebhookDeps {
  return {
    providers: {
      WOMPI: new WompiPaymentProvider({ publicKey: "", integritySecret: "", eventSecret: "" }),
      PAYPAL: new PayPalPaymentProvider({
        clientId: "sandbox-client-id",
        clientSecret: "sandbox-client-secret",
        webhookId: "sandbox-webhook-id",
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PayPal (nivel 1 — mocks de red, Postgres real): webhook -> Payment -> Order -> Entitlement", () => {
  it("PAYMENT.CAPTURE.COMPLETED: crea Payment APPROVED, marca Order PAID y otorga Entitlement", async () => {
    vi.stubGlobal("fetch", mockPayPalFetch("SUCCESS"));
    const fixture = await createFixtureOffer();
    const captureId = `paypal-${randomUUID()}`;
    const rawBody = buildPayPalCaptureEvent({
      eventId: `WH-${randomUUID()}`,
      eventType: "PAYMENT.CAPTURE.COMPLETED",
      captureId,
      checkoutSessionId: fixture.checkoutSession.id,
      amountInCents: fixture.price.amount,
      currency: fixture.price.currency,
    });

    const result = await processProviderWebhook(makeDeps(), {
      provider: "PAYPAL",
      rawBody,
      headers: TEST_PAYPAL_REQUIRED_HEADERS,
    });
    expect(result.outcome).toBe("processed");

    const order = await prisma.order.findUnique({ where: { checkoutSessionId: fixture.checkoutSession.id } });
    expect(order?.status).toBe("PAID");

    const payment = await prisma.payment.findUnique({
      where: { provider_providerReference: { provider: "PAYPAL", providerReference: captureId } },
    });
    expect(payment?.status).toBe("APPROVED");
    expect(payment?.amount).toBe(fixture.price.amount);

    const entitlements = await prisma.entitlement.findMany({ where: { sourceOrderId: order!.id } });
    expect(entitlements).toHaveLength(1);
    expect(entitlements[0]?.productId).toBe(fixture.product.id);
  });

  it("PAYMENT.CAPTURE.DENIED: registra Payment DECLINED, cancela el Order, sin Entitlement", async () => {
    vi.stubGlobal("fetch", mockPayPalFetch("SUCCESS"));
    const fixture = await createFixtureOffer();
    const captureId = `paypal-${randomUUID()}`;
    const rawBody = buildPayPalCaptureEvent({
      eventId: `WH-${randomUUID()}`,
      eventType: "PAYMENT.CAPTURE.DENIED",
      captureId,
      checkoutSessionId: fixture.checkoutSession.id,
      amountInCents: fixture.price.amount,
      currency: fixture.price.currency,
    });

    const result = await processProviderWebhook(makeDeps(), {
      provider: "PAYPAL",
      rawBody,
      headers: TEST_PAYPAL_REQUIRED_HEADERS,
    });
    expect(result.outcome).toBe("processed");

    const order = await prisma.order.findUnique({ where: { checkoutSessionId: fixture.checkoutSession.id } });
    expect(order?.status).toBe("CANCELLED");

    const payment = await prisma.payment.findUnique({
      where: { provider_providerReference: { provider: "PAYPAL", providerReference: captureId } },
    });
    expect(payment?.status).toBe("DECLINED");

    const entitlements = await prisma.entitlement.findMany({ where: { sourceOrderId: order!.id } });
    expect(entitlements).toHaveLength(0);
  });

  it("firma inválida (verification_status FAILURE): rechaza el webhook y no escribe nada", async () => {
    vi.stubGlobal("fetch", mockPayPalFetch("FAILURE"));
    const fixture = await createFixtureOffer();
    const captureId = `paypal-${randomUUID()}`;
    const rawBody = buildPayPalCaptureEvent({
      eventId: `WH-${randomUUID()}`,
      eventType: "PAYMENT.CAPTURE.COMPLETED",
      captureId,
      checkoutSessionId: fixture.checkoutSession.id,
      amountInCents: fixture.price.amount,
      currency: fixture.price.currency,
    });

    const result = await processProviderWebhook(makeDeps(), {
      provider: "PAYPAL",
      rawBody,
      headers: TEST_PAYPAL_REQUIRED_HEADERS,
    });
    expect(result.outcome).toBe("invalid_signature");

    const order = await prisma.order.findUnique({ where: { checkoutSessionId: fixture.checkoutSession.id } });
    expect(order).toBeNull();
    const payment = await prisma.payment.findUnique({
      where: { provider_providerReference: { provider: "PAYPAL", providerReference: captureId } },
    });
    expect(payment).toBeNull();
  });

  it("faltan headers PAYPAL-*: rechaza sin siquiera llamar a la verificación remota", async () => {
    const fetchMock = mockPayPalFetch("SUCCESS");
    vi.stubGlobal("fetch", fetchMock);
    const fixture = await createFixtureOffer();
    const rawBody = buildPayPalCaptureEvent({
      eventId: `WH-${randomUUID()}`,
      eventType: "PAYMENT.CAPTURE.COMPLETED",
      captureId: `paypal-${randomUUID()}`,
      checkoutSessionId: fixture.checkoutSession.id,
      amountInCents: fixture.price.amount,
      currency: fixture.price.currency,
    });

    const result = await processProviderWebhook(makeDeps(), { provider: "PAYPAL", rawBody, headers: {} });
    expect(result.outcome).toBe("invalid_signature");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("webhook duplicado: la segunda entrega idéntica es un no-op idempotente", async () => {
    vi.stubGlobal("fetch", mockPayPalFetch("SUCCESS"));
    const fixture = await createFixtureOffer();
    const captureId = `paypal-${randomUUID()}`;
    const rawBody = buildPayPalCaptureEvent({
      eventId: `WH-${randomUUID()}`,
      eventType: "PAYMENT.CAPTURE.COMPLETED",
      captureId,
      checkoutSessionId: fixture.checkoutSession.id,
      amountInCents: fixture.price.amount,
      currency: fixture.price.currency,
    });

    const first = await processProviderWebhook(makeDeps(), {
      provider: "PAYPAL",
      rawBody,
      headers: TEST_PAYPAL_REQUIRED_HEADERS,
    });
    const second = await processProviderWebhook(makeDeps(), {
      provider: "PAYPAL",
      rawBody,
      headers: TEST_PAYPAL_REQUIRED_HEADERS,
    });

    expect(first.outcome).toBe("processed");
    expect(second.outcome).toBe("duplicate");

    const order = await prisma.order.findUnique({ where: { checkoutSessionId: fixture.checkoutSession.id } });
    const payments = await prisma.payment.findMany({ where: { orderId: order!.id } });
    const entitlements = await prisma.entitlement.findMany({ where: { sourceOrderId: order!.id } });
    expect(payments).toHaveLength(1);
    expect(entitlements).toHaveLength(1);
  });

  it("ADR-014: la misma referencia entre Wompi y PayPal no colisiona (UNIQUE compuesto por proveedor)", async () => {
    const fixtureA = await createFixtureOffer();
    const fixtureB = await createFixtureOffer();
    const orders = new PrismaOrderRepository();
    const payments = new PrismaPaymentRepository();

    const orderA = await orders.createFromCheckoutSession(fixtureA.checkoutSession.id);
    const orderB = await orders.createFromCheckoutSession(fixtureB.checkoutSession.id);
    const sharedReference = `shared-ref-${randomUUID()}`;

    await payments.upsertByProviderReference({
      orderId: orderA.id,
      provider: "WOMPI",
      providerReference: sharedReference,
      status: "APPROVED",
      amount: fixtureA.price.amount,
      currency: fixtureA.price.currency,
    });
    await payments.upsertByProviderReference({
      orderId: orderB.id,
      provider: "PAYPAL",
      providerReference: sharedReference,
      status: "APPROVED",
      amount: fixtureB.price.amount,
      currency: fixtureB.price.currency,
    });

    const count = await prisma.payment.count({ where: { providerReference: sharedReference } });
    expect(count).toBe(2);
  });
});
