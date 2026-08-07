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
        publicKey: "pub_test_local",
        integritySecret: "test_integrity_secret_local",
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

describe("Wompi: webhook -> Payment -> Order -> Entitlement (Postgres real)", () => {
  it("pago APPROVED: crea Payment APPROVED, marca Order PAID y otorga Entitlement", async () => {
    const fixture = await createFixtureOffer();
    const transactionId = `wompi-${randomUUID()}`;
    const rawBody = buildSignedWompiWebhook({
      checkoutSessionId: fixture.checkoutSession.id,
      transactionId,
      status: "APPROVED",
      amountInCents: fixture.price.amount,
      currency: fixture.price.currency,
    });

    const result = await processProviderWebhook(makeDeps(), { provider: "WOMPI", rawBody, headers: {} });
    expect(result.outcome).toBe("processed");

    const order = await prisma.order.findUnique({ where: { checkoutSessionId: fixture.checkoutSession.id } });
    expect(order?.status).toBe("PAID");

    const payment = await prisma.payment.findUnique({
      where: { provider_providerReference: { provider: "WOMPI", providerReference: transactionId } },
    });
    expect(payment?.status).toBe("APPROVED");
    expect(payment?.amount).toBe(fixture.price.amount);

    const entitlements = await prisma.entitlement.findMany({ where: { sourceOrderId: order!.id } });
    expect(entitlements).toHaveLength(1);
    const [entitlement] = entitlements;
    expect(entitlement?.productId).toBe(fixture.product.id);
    expect(entitlement?.customerId).toBe(fixture.customer.id);
  });

  it("pago DECLINED: registra Payment DECLINED, Order sigue PENDING, sin Entitlement", async () => {
    const fixture = await createFixtureOffer();
    const transactionId = `wompi-${randomUUID()}`;
    const rawBody = buildSignedWompiWebhook({
      checkoutSessionId: fixture.checkoutSession.id,
      transactionId,
      status: "DECLINED",
      amountInCents: fixture.price.amount,
      currency: fixture.price.currency,
    });

    const result = await processProviderWebhook(makeDeps(), { provider: "WOMPI", rawBody, headers: {} });
    expect(result.outcome).toBe("processed");

    const order = await prisma.order.findUnique({ where: { checkoutSessionId: fixture.checkoutSession.id } });
    expect(order?.status).toBe("PENDING");

    const payment = await prisma.payment.findUnique({
      where: { provider_providerReference: { provider: "WOMPI", providerReference: transactionId } },
    });
    expect(payment?.status).toBe("DECLINED");

    const entitlements = await prisma.entitlement.findMany({ where: { sourceOrderId: order!.id } });
    expect(entitlements).toHaveLength(0);
  });

  it("pago ERROR: se normaliza a FAILED, Order sigue PENDING", async () => {
    const fixture = await createFixtureOffer();
    const transactionId = `wompi-${randomUUID()}`;
    const rawBody = buildSignedWompiWebhook({
      checkoutSessionId: fixture.checkoutSession.id,
      transactionId,
      status: "ERROR",
      amountInCents: fixture.price.amount,
      currency: fixture.price.currency,
    });

    const result = await processProviderWebhook(makeDeps(), { provider: "WOMPI", rawBody, headers: {} });
    expect(result.outcome).toBe("processed");

    const payment = await prisma.payment.findUnique({
      where: { provider_providerReference: { provider: "WOMPI", providerReference: transactionId } },
    });
    expect(payment?.status).toBe("FAILED");
  });

  it("firma inválida: rechaza el webhook y no escribe absolutamente nada", async () => {
    const fixture = await createFixtureOffer();
    const transactionId = `wompi-${randomUUID()}`;
    const rawBody = buildSignedWompiWebhook({
      checkoutSessionId: fixture.checkoutSession.id,
      transactionId,
      status: "APPROVED",
      amountInCents: fixture.price.amount,
      currency: fixture.price.currency,
    });
    // Altera el monto después de firmar -> el checksum ya no corresponde al payload.
    const tampered = rawBody.replace(String(fixture.price.amount), String(fixture.price.amount + 1));

    const result = await processProviderWebhook(makeDeps(), { provider: "WOMPI", rawBody: tampered, headers: {} });
    expect(result.outcome).toBe("invalid_signature");

    const order = await prisma.order.findUnique({ where: { checkoutSessionId: fixture.checkoutSession.id } });
    expect(order).toBeNull();

    const payment = await prisma.payment.findUnique({
      where: { provider_providerReference: { provider: "WOMPI", providerReference: transactionId } },
    });
    expect(payment).toBeNull();
  });

  it("webhook duplicado: la segunda entrega idéntica es un no-op idempotente", async () => {
    const fixture = await createFixtureOffer();
    const transactionId = `wompi-${randomUUID()}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const rawBody = buildSignedWompiWebhook({
      checkoutSessionId: fixture.checkoutSession.id,
      transactionId,
      status: "APPROVED",
      amountInCents: fixture.price.amount,
      currency: fixture.price.currency,
      timestamp,
    });

    const first = await processProviderWebhook(makeDeps(), { provider: "WOMPI", rawBody, headers: {} });
    const second = await processProviderWebhook(makeDeps(), { provider: "WOMPI", rawBody, headers: {} });

    expect(first.outcome).toBe("processed");
    expect(second.outcome).toBe("duplicate");

    const order = await prisma.order.findUnique({ where: { checkoutSessionId: fixture.checkoutSession.id } });
    const payments = await prisma.payment.findMany({ where: { orderId: order!.id } });
    const entitlements = await prisma.entitlement.findMany({ where: { sourceOrderId: order!.id } });

    expect(payments).toHaveLength(1);
    expect(entitlements).toHaveLength(1);
  });

  it("idempotencia de Order: createFromCheckoutSession llamado dos veces no duplica", async () => {
    const fixture = await createFixtureOffer();
    const orders = new PrismaOrderRepository();

    const first = await orders.createFromCheckoutSession(fixture.checkoutSession.id);
    const second = await orders.createFromCheckoutSession(fixture.checkoutSession.id);

    expect(first.id).toBe(second.id);
    const count = await prisma.order.count({ where: { checkoutSessionId: fixture.checkoutSession.id } });
    expect(count).toBe(1);
  });

  it("idempotencia de Entitlement: grantForOrder llamado dos veces no duplica", async () => {
    const fixture = await createFixtureOffer();
    const orders = new PrismaOrderRepository();
    const entitlements = new PrismaEntitlementRepository();

    const order = await orders.createFromCheckoutSession(fixture.checkoutSession.id);
    await entitlements.grantForOrder(order.id);
    await entitlements.grantForOrder(order.id);

    const count = await prisma.entitlement.count({ where: { sourceOrderId: order.id } });
    expect(count).toBe(1);
  });

  it("idempotencia de Payment: upsertByProviderReference con la misma referencia actualiza en vez de duplicar", async () => {
    const fixture = await createFixtureOffer();
    const orders = new PrismaOrderRepository();
    const payments = new PrismaPaymentRepository();

    const order = await orders.createFromCheckoutSession(fixture.checkoutSession.id);
    const reference = `wompi-${randomUUID()}`;

    await payments.upsertByProviderReference({
      orderId: order.id,
      provider: "WOMPI",
      providerReference: reference,
      status: "PENDING",
      amount: fixture.price.amount,
      currency: fixture.price.currency,
    });
    await payments.upsertByProviderReference({
      orderId: order.id,
      provider: "WOMPI",
      providerReference: reference,
      status: "APPROVED",
      amount: fixture.price.amount,
      currency: fixture.price.currency,
    });

    const count = await prisma.payment.count({ where: { provider: "WOMPI", providerReference: reference } });
    expect(count).toBe(1);

    const payment = await prisma.payment.findUnique({
      where: { provider_providerReference: { provider: "WOMPI", providerReference: reference } },
    });
    expect(payment?.status).toBe("APPROVED");
  });
});
