import { randomUUID } from "node:crypto";
import { prisma } from "../src/infrastructure/prisma/client";

/**
 * Crea un Product/Offer/Price/Customer/CheckoutSession reales en la base de
 * datos (nunca mocks) para que cada test de webhook tenga un checkout válido
 * y aislado sobre el que operar.
 */
export async function createFixtureOffer(overrides?: {
  checkoutSessionId?: string;
  provider?: "WOMPI" | "PAYPAL";
  amount?: number;
  currency?: string;
}) {
  const product = await prisma.product.create({
    data: { name: `Test Product ${randomUUID()}`, type: "DIGITAL", status: "PUBLISHED" },
  });

  const offer = await prisma.offer.create({
    data: {
      productId: product.id,
      name: "Test Offer",
      isActive: true,
      prices: { create: { amount: overrides?.amount ?? 5_000_000, currency: overrides?.currency ?? "COP", interval: "ONE_TIME" } },
    },
    include: { prices: true },
  });

  const price = offer.prices[0];
  if (!price) {
    throw new Error("createFixtureOffer: la Offer de prueba no generó ningún Price");
  }

  const customer = await prisma.customer.create({
    data: { email: `buyer-${randomUUID()}@example.com` },
  });

  const checkoutSession = await prisma.checkoutSession.create({
    data: {
      ...(overrides?.checkoutSessionId ? { id: overrides.checkoutSessionId } : {}),
      offerId: offer.id,
      priceId: price.id,
      customerId: customer.id,
      provider: overrides?.provider ?? "WOMPI",
    },
  });

  return { product, offer, price, customer, checkoutSession };
}
