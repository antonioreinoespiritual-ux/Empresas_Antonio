import { describe, expect, it } from "vitest";
import {
  PrismaOrderRepository,
  PrismaPaymentRepository,
  PrismaEntitlementRepository,
  PayPalPaymentProvider,
} from "../src/infrastructure";
import { prisma } from "../src/infrastructure/prisma/client";
import { createFixtureOffer } from "./fixtures";

// Prueba deliberadamente NO incluida en `pnpm test` normal ni en CI: verifica
// la ÚNICA forma real de capturar un pago en esta cuenta sandbox de PayPal
// (Colombia), dado que la documentación oficial de PayPal confirma que las
// cuentas Business registradas en Colombia NO son elegibles para Advanced
// Credit and Debit Card Payments (procesamiento directo de tarjeta) — ver
// PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING en paypal-sandbox-live.test.ts. La
// única vía real que queda es el checkout estándar: el comprador aprueba en
// una página de PayPal en su propio navegador (no automatizable desde este
// contenedor: no permite abrir conexiones HTTPS con un navegador real, ver
// notas de la sesión). Por eso este test asume que la aprobación humana ya
// ocurrió y se le pasa la Order ya aprobada por variables de entorno.
//
// Para generar una nueva Order y su link de aprobación real, correr un
// script puntual que llame a POST /v2/checkout/orders con
// application_context.user_action = "PAY_NOW" y tomar el link `rel:approve`.
// Un humano lo abre, inicia sesión con una cuenta sandbox de comprador y
// aprueba. Recién ahí esta prueba puede correr.
const ORDER_ID = process.env.PAYPAL_APPROVED_ORDER_ID;
const CHECKOUT_SESSION_ID = process.env.PAYPAL_APPROVED_CHECKOUT_SESSION_ID;
const AMOUNT_CENTS = Number(process.env.PAYPAL_APPROVED_AMOUNT_CENTS ?? "2500");
const CURRENCY = process.env.PAYPAL_APPROVED_CURRENCY ?? "USD";

const shouldRun =
  process.env.RUN_LIVE_PAYPAL_FULL_CAPTURE_TEST === "1" &&
  !!ORDER_ID &&
  !!CHECKOUT_SESSION_ID &&
  !!process.env.PAYPAL_CLIENT_SECRET;

const BASE_URL = process.env.PAYPAL_API_BASE_URL ?? "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString(
    "base64"
  );
  const response = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const body = (await response.json()) as { access_token: string };
  expect(response.status, JSON.stringify(body)).toBe(200);
  return body.access_token;
}

interface Capture {
  id: string;
  status: string;
  amount: { value: string; currency_code: string };
  custom_id?: string;
}

describe.skipIf(!shouldRun)(
  "PayPal SANDBOX REAL: Order aprobada por un comprador humano en navegador -> capture real -> Payment/Order/Entitlement",
  () => {
    it("procesa una captura real con el código de producción, hasta Entitlement", async () => {
      const token = await getAccessToken();

      // 1) La Order fue creada y aprobada fuera de este proceso (navegador real
      // del usuario, cuenta sandbox de comprador tipo Personal). Confirmamos su
      // estado real antes de tocar nuestra base de datos.
      const getRes = await fetch(`${BASE_URL}/v2/checkout/orders/${ORDER_ID}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const order = (await getRes.json()) as {
        status: string;
        purchase_units: Array<{ payments?: { captures?: Capture[] } }>;
      };
      expect(getRes.status, JSON.stringify(order)).toBe(200);
      expect(["APPROVED", "COMPLETED"]).toContain(order.status);

      // 2) Si todavía no fue capturada, la capturamos ahora (real, server-to-server).
      let capture: Capture;
      const existingCapture = order.purchase_units[0]?.payments?.captures?.[0];
      if (existingCapture) {
        capture = existingCapture;
      } else {
        const captureRes = await fetch(`${BASE_URL}/v2/checkout/orders/${ORDER_ID}/capture`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": `capture-${ORDER_ID}`,
          },
        });
        const captureBody = (await captureRes.json()) as {
          purchase_units: Array<{ payments: { captures: Capture[] } }>;
        };
        expect(captureRes.status, JSON.stringify(captureBody)).toBe(201);
        const first = captureBody.purchase_units[0]?.payments.captures[0];
        if (!first) throw new Error("Capture real no devolvió ninguna captura");
        capture = first;
      }
      expect(capture.status).toBe("COMPLETED");
      // eslint-disable-next-line no-console
      console.log("REAL PAYPAL CAPTURE:", capture.id, "orderId:", ORDER_ID);

      // 3) Intento honesto de verificación real de firma: sin una entrega
      // genuina de webhook, PayPal no puede validar headers PAYPAL-* falsos.
      // Esto documenta, con una llamada real a PayPal, que el Nivel 3 sigue
      // bloqueado — no lo simulamos como PASS.
      const provider = new PayPalPaymentProvider({
        clientId: process.env.PAYPAL_CLIENT_ID!,
        clientSecret: process.env.PAYPAL_CLIENT_SECRET!,
        webhookId: process.env.PAYPAL_WEBHOOK_ID || "no-configurado",
        apiBaseUrl: BASE_URL,
        webBaseUrl: process.env.APP_BASE_URL ?? "https://example.com",
      });
      const fakeEventBody = JSON.stringify({
        id: `WH-${capture.id}`,
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: { id: capture.id, status: "COMPLETED", custom_id: CHECKOUT_SESSION_ID, amount: capture.amount },
      });
      const verifiedEvent = await provider.verifyAndParseWebhook(fakeEventBody, {
        "paypal-auth-algo": "SHA256withRSA",
        "paypal-cert-url": "https://api.sandbox.paypal.com/not-a-real-delivery",
        "paypal-transmission-id": "not-a-real-delivery",
        "paypal-transmission-sig": "not-a-real-delivery",
        "paypal-transmission-time": new Date().toISOString(),
      });
      expect(verifiedEvent).toBeNull(); // Nivel 3 sigue BLOQUEADO/PENDIENTE de staging, tal cual esperado.

      // 4) Preparamos el fixture retroactivo: el CheckoutSession con el mismo id
      // que usamos como custom_id al crear la Order real.
      const fixture = await createFixtureOffer({
        checkoutSessionId: CHECKOUT_SESSION_ID,
        provider: "PAYPAL",
        amount: AMOUNT_CENTS,
        currency: CURRENCY,
      });

      // 5) Escribimos con el MISMO camino de producción que usa
      // processProviderWebhook (createFromCheckoutSession -> upsert Payment ->
      // markAsPaid -> grantForOrder), usando los datos REALES de la captura.
      // El único paso que no se ejecuta es la verificación de firma (ya
      // probada por separado arriba, y bloqueada por falta de Nivel 3).
      const orders = new PrismaOrderRepository();
      const payments = new PrismaPaymentRepository();
      const entitlements = new PrismaEntitlementRepository();

      const dbOrder = await orders.createFromCheckoutSession(fixture.checkoutSession.id);
      await payments.upsertByProviderReference({
        orderId: dbOrder.id,
        provider: "PAYPAL",
        providerReference: capture.id,
        status: provider.normalizeStatus("PAYMENT.CAPTURE.COMPLETED"),
        amount: AMOUNT_CENTS,
        currency: CURRENCY,
      });
      await orders.markAsPaid(dbOrder.id);
      await entitlements.grantForOrder(dbOrder.id);

      // 6) Verificación final en base de datos real.
      const finalOrder = await prisma.order.findUnique({ where: { checkoutSessionId: fixture.checkoutSession.id } });
      expect(finalOrder?.status).toBe("PAID");

      const payment = await prisma.payment.findUnique({
        where: { provider_providerReference: { provider: "PAYPAL", providerReference: capture.id } },
      });
      expect(payment?.status).toBe("APPROVED");
      expect(payment?.amount).toBe(AMOUNT_CENTS);

      const grantedEntitlements = await prisma.entitlement.findMany({ where: { sourceOrderId: finalOrder!.id } });
      expect(grantedEntitlements).toHaveLength(1);
      expect(grantedEntitlements[0]?.productId).toBe(fixture.product.id);

      // eslint-disable-next-line no-console
      console.log(
        "REAL PAYPAL SANDBOX TRANSACTION:",
        capture.id,
        "-> Order:",
        finalOrder!.id,
        "-> Entitlement:",
        grantedEntitlements[0]?.id
      );
    });
  }
);
