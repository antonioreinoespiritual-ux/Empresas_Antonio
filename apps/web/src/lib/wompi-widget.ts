export interface WompiWidgetResult {
  transaction: { id: string; status: string };
}

interface WompiWidgetCheckoutConfig {
  currency: string;
  amountInCents: number;
  reference: string;
  publicKey: string;
  signature: { integrity: string };
}

interface WompiWidgetCheckoutInstance {
  open(callback: (result: WompiWidgetResult) => void): void;
}

declare global {
  interface Window {
    WidgetCheckout?: new (config: WompiWidgetCheckoutConfig) => WompiWidgetCheckoutInstance;
  }
}

const WOMPI_WIDGET_SRC = "https://checkout.wompi.co/widget.js";

let widgetScriptPromise: Promise<void> | null = null;

function loadWompiWidgetScript(): Promise<void> {
  if (window.WidgetCheckout) return Promise.resolve();
  if (!widgetScriptPromise) {
    widgetScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = WOMPI_WIDGET_SRC;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("No se pudo cargar el widget de pago de Wompi"));
      document.body.appendChild(script);
    });
  }
  return widgetScriptPromise;
}

/**
 * Abre el Widget de Wompi con los datos preparados server-side (incluye la
 * firma de integridad calculada con el integrity secret, nunca expuesto al
 * navegador). El callback se dispara con el resultado del intento de pago,
 * pero es solo informativo: la confirmación real llega por webhook (ADR-011).
 */
export async function openWompiWidget(clientPayload: {
  publicKey: string;
  currency: string;
  amountInCents: number;
  reference: string;
  signature: string;
}): Promise<WompiWidgetResult> {
  await loadWompiWidgetScript();

  if (!window.WidgetCheckout) {
    throw new Error("El widget de Wompi no se pudo inicializar");
  }

  const checkout = new window.WidgetCheckout({
    currency: clientPayload.currency,
    amountInCents: clientPayload.amountInCents,
    reference: clientPayload.reference,
    publicKey: clientPayload.publicKey,
    signature: { integrity: clientPayload.signature },
  });

  return new Promise((resolve) => {
    checkout.open((result) => resolve(result));
  });
}
