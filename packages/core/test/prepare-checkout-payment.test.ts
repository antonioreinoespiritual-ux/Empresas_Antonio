import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareCheckoutPayment } from "../src/application";
import {
  WompiPaymentProvider,
  PayPalPaymentProvider,
  PrismaCheckoutSessionRepository,
  PrismaOfferRepository,
} from "../src/infrastructure";
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

// Regla de negocio confirmada empíricamente contra la API real de PayPal
// (CURRENCY_NOT_SUPPORTED para COP) y contra la documentación oficial — no es
// negociable en la UI, así que el caso de uso la aplica también server-side.
describe("prepareCheckoutPayment: compatibilidad de proveedor por moneda (sin conversión automática)", () => {
  it("rechaza PayPal para un Price en COP sin llamar a ningún proveedor externo", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const fixture = await createFixtureOffer({ currency: "COP" });

    await expect(
      prepareCheckoutPayment(makeDeps(), { checkoutSessionId: fixture.checkoutSession.id, provider: "PAYPAL" })
    ).rejects.toThrow(/no admite pagos en COP/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rechaza PayPal para una moneda de 0 decimales (JPY) sin llamar a ningún proveedor externo", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const fixture = await createFixtureOffer({ currency: "JPY", amount: 1000 });

    await expect(
      prepareCheckoutPayment(makeDeps(), { checkoutSessionId: fixture.checkoutSession.id, provider: "PAYPAL" })
    ).rejects.toThrow(/no admite pagos en JPY/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("permite Wompi para un Price en COP", async () => {
    const fixture = await createFixtureOffer({ currency: "COP" });

    const prepared = await prepareCheckoutPayment(makeDeps(), {
      checkoutSessionId: fixture.checkoutSession.id,
      provider: "WOMPI",
    });
    expect(prepared.provider).toBe("WOMPI");
  });

  it("permite PayPal para un Price en USD y expone el approveUrl real de la Order", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = input.toString();
      if (url.endsWith("/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      }
      if (url.endsWith("/v2/checkout/orders")) {
        return new Response(
          JSON.stringify({
            id: "ORDER1",
            status: "CREATED",
            links: [{ rel: "approve", href: "https://sandbox.paypal.com/checkoutnow?token=ORDER1" }],
          }),
          { status: 201 }
        );
      }
      throw new Error("mock fetch: URL no esperada " + url);
    });
    vi.stubGlobal("fetch", fetchMock);

    const fixture = await createFixtureOffer({ currency: "USD" });

    const prepared = await prepareCheckoutPayment(makeDeps(), {
      checkoutSessionId: fixture.checkoutSession.id,
      provider: "PAYPAL",
    });
    expect(prepared.provider).toBe("PAYPAL");
    expect(prepared.clientPayload.approveUrl).toBe("https://sandbox.paypal.com/checkoutnow?token=ORDER1");
    expect(prepared.clientPayload.orderId).toBe("ORDER1");
  });
});
