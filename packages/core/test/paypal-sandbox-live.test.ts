import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

// Prueba deliberadamente NO incluida en el `pnpm test` normal ni en CI: hace
// llamadas reales a la API sandbox de PayPal con credenciales reales. Solo
// corre si se invoca explícitamente con RUN_LIVE_PAYPAL_TEST=1 y variables
// PAYPAL_* reales en el entorno.
//
// A diferencia de Wompi, esta prueba NO llega a un pago capturado real: la
// cuenta sandbox provista no tiene habilitado el procesamiento directo de
// tarjeta (PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING, confirmado empíricamente
// abajo) y completar la aprobación estándar de PayPal requiere un navegador
// + credenciales de una cuenta sandbox de comprador que no tenemos. Lo que
// SÍ queda probado y documentado aquí, con datos 100% reales de los
// servidores de PayPal: autenticación OAuth2, creación real de Order,
// rechazo real de COP como moneda, consulta real de estado, y el mensaje de
// error real al intentar capturar sin aprobación del comprador.
const shouldRun = process.env.RUN_LIVE_PAYPAL_TEST === "1" && !!process.env.PAYPAL_CLIENT_SECRET;

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

describe.skipIf(!shouldRun)("PayPal SANDBOX REAL: hallazgos reales contra api-m.sandbox.paypal.com", () => {
  it("OAuth2 client_credentials real emite un access_token", async () => {
    const token = await getAccessToken();
    expect(token.length).toBeGreaterThan(20);
  });

  it("COP es rechazada por la API real (CURRENCY_NOT_SUPPORTED) — hallazgo de negocio, no un bug", async () => {
    const token = await getAccessToken();
    const response = await fetch(`${BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ reference_id: randomUUID(), amount: { currency_code: "COP", value: "50000.00" } }],
      }),
    });
    const body = (await response.json()) as { details?: Array<{ issue: string }> };
    expect(response.status).toBe(422);
    expect(body.details?.[0]?.issue).toBe("CURRENCY_NOT_SUPPORTED");
  });

  it("crea una Order real en USD (status CREATED) y la consulta real por GET", async () => {
    const token = await getAccessToken();
    const referenceId = `live-test-${randomUUID()}`;
    const createResponse = await fetch(`${BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          { reference_id: referenceId, custom_id: referenceId, amount: { currency_code: "USD", value: "50.00" } },
        ],
      }),
    });
    const order = (await createResponse.json()) as { id: string; status: string };
    expect(createResponse.status).toBe(201);
    expect(order.status).toBe("CREATED");

    const getResponse = await fetch(`${BASE_URL}/v2/checkout/orders/${order.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const fetched = (await getResponse.json()) as {
      status: string;
      purchase_units: Array<{ custom_id: string }>;
    };
    expect(getResponse.status).toBe(200);
    expect(fetched.status).toBe("CREATED");
    // Confirma que custom_id (nuestra referencia a CheckoutSession) sobrevive el round-trip real.
    expect(fetched.purchase_units[0]?.custom_id).toBe(referenceId);
  });

  it("BLOQUEADO (cuenta, no código): captura directa con tarjeta -> PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING", async () => {
    const token = await getAccessToken();
    const response = await fetch(`${BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": randomUUID(),
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ reference_id: randomUUID(), amount: { currency_code: "USD", value: "50.00" } }],
        payment_source: {
          card: { number: "4032039975659357", expiry: "2029-12", security_code: "123", name: "Sandbox Buyer" },
        },
      }),
    });
    const body = (await response.json()) as { details?: Array<{ issue: string }> };
    expect(response.status).toBe(422);
    // Documenta el bloqueo real: esta cuenta sandbox no tiene habilitado
    // Advanced Credit and Debit Card Payments. No es un fallo de nuestro
    // código — PayPal exige aprobación de cuenta para esta capacidad.
    expect(body.details?.[0]?.issue).toBe("PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING");
  });

  it("BLOQUEADO (requiere navegador+comprador): capturar sin aprobación -> ORDER_NOT_APPROVED", async () => {
    const token = await getAccessToken();
    const createResponse = await fetch(`${BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ reference_id: randomUUID(), amount: { currency_code: "USD", value: "50.00" } }],
      }),
    });
    const order = (await createResponse.json()) as { id: string };

    const captureResponse = await fetch(`${BASE_URL}/v2/checkout/orders/${order.id}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const body = (await captureResponse.json()) as { details?: Array<{ issue: string }> };
    expect(captureResponse.status).toBe(422);
    expect(body.details?.[0]?.issue).toBe("ORDER_NOT_APPROVED");
  });
});
