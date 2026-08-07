import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareCheckoutPayment } from "../src/application";
import {
  PrismaCheckoutSessionRepository,
  PrismaOfferRepository,
  WompiPaymentProvider,
  PayPalPaymentProvider,
} from "../src/infrastructure";
import {
  assertEnabledProvidersAreCompatible,
  compatibleProviders,
  getAvailableProviders,
} from "../src/domain";
import { prisma } from "../src/infrastructure/prisma/client";
import { createFixtureOffer } from "./fixtures";

function makeProviders() {
  return {
    WOMPI: new WompiPaymentProvider({ publicKey: "pub", integritySecret: "secret", eventSecret: "events" }),
    PAYPAL: new PayPalPaymentProvider({
      clientId: "client-id",
      clientSecret: "client-secret",
      webhookId: "webhook-id",
      apiBaseUrl: "https://api-m.sandbox.paypal.com",
      webBaseUrl: "https://checkout.example.com",
    }),
  };
}

function makeDeps() {
  return { checkoutSessions: new PrismaCheckoutSessionRepository(), offers: new PrismaOfferRepository(), providers: makeProviders() };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("compatibleProviders / getAvailableProviders: intersección compatibleProviders(currency) ∩ enabledProviders", () => {
  it("compatibleProviders excluye PayPal para COP", () => {
    expect(compatibleProviders("COP")).toEqual(["WOMPI"]);
  });

  it("compatibleProviders incluye ambos para USD", () => {
    expect(compatibleProviders("USD")).toEqual(["WOMPI", "PAYPAL"]);
  });

  it("enabledProviders null devuelve únicamente compatibleProviders(currency)", () => {
    expect(getAvailableProviders("USD", null)).toEqual(["WOMPI", "PAYPAL"]);
    expect(getAvailableProviders("COP", null)).toEqual(["WOMPI"]);
  });

  it("enabledProviders restringe el subconjunto sin poder ampliarlo más allá de lo compatible", () => {
    expect(getAvailableProviders("USD", ["WOMPI"])).toEqual(["WOMPI"]);
    // aunque el Price "declare" PAYPAL como habilitado, COP lo filtra igual
    expect(getAvailableProviders("COP", ["WOMPI", "PAYPAL"])).toEqual(["WOMPI"]);
  });
});

describe("assertEnabledProvidersAreCompatible: guarda contra un enabledProviders inválido", () => {
  it("no lanza con null", () => {
    expect(() => assertEnabledProvidersAreCompatible("COP", null)).not.toThrow();
  });

  it("no lanza cuando el subconjunto es compatible", () => {
    expect(() => assertEnabledProvidersAreCompatible("USD", ["WOMPI"])).not.toThrow();
  });

  it("lanza DomainError si se intenta habilitar PayPal para COP", () => {
    expect(() => assertEnabledProvidersAreCompatible("COP", ["WOMPI", "PAYPAL"])).toThrow(/no es compatible/);
  });
});

describe("PrismaOfferRepository: rechaza server-side un enabledProviders incompatible al crear el Price", () => {
  it("create() rechaza una Offer con un Price COP + enabledProviders: [PAYPAL]", async () => {
    const product = await prisma.product.create({
      data: { name: `Test Product ${randomUUID()}`, type: "DIGITAL", status: "PUBLISHED" },
    });
    const repo = new PrismaOfferRepository();

    await expect(
      repo.create({
        productId: product.id,
        name: "Payload manipulado",
        prices: [{ amount: 1000, currency: "COP", interval: "ONE_TIME", enabledProviders: ["PAYPAL"] }],
      })
    ).rejects.toThrow(/no es compatible/);
  });

  it("addPrice() rechaza agregar un Price COP + enabledProviders: [PAYPAL] a una Offer existente", async () => {
    const fixture = await createFixtureOffer({ currency: "COP" });
    const repo = new PrismaOfferRepository();

    await expect(
      repo.addPrice(fixture.offer.id, { amount: 1000, currency: "COP", interval: "ONE_TIME", enabledProviders: ["PAYPAL"] })
    ).rejects.toThrow(/no es compatible/);
  });

  it("addPrice() persiste null en dominio cuando enabledProviders queda vacío en columna", async () => {
    const fixture = await createFixtureOffer({ currency: "USD" });
    const repo = new PrismaOfferRepository();

    const created = await repo.addPrice(fixture.offer.id, { amount: 1000, currency: "USD", interval: "ONE_TIME" });
    expect(created.enabledProviders).toBeNull();
  });
});

describe("prepareCheckoutPayment: enabledProviders restringido por admin también se aplica server-side", () => {
  it("rechaza WOMPI si el admin dejó únicamente PAYPAL habilitado, aun siendo técnicamente compatible", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const fixture = await createFixtureOffer({ currency: "USD", enabledProviders: ["PAYPAL"] });

    await expect(
      prepareCheckoutPayment(makeDeps(), { checkoutSessionId: fixture.checkoutSession.id, provider: "WOMPI" })
    ).rejects.toThrow(/no está disponible/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("permite el único proveedor que el admin dejó habilitado", async () => {
    const fixture = await createFixtureOffer({ currency: "COP", enabledProviders: ["WOMPI"] });

    const prepared = await prepareCheckoutPayment(makeDeps(), {
      checkoutSessionId: fixture.checkoutSession.id,
      provider: "WOMPI",
    });
    expect(prepared.provider).toBe("WOMPI");
  });
});
