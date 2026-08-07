import type { PaymentProviderType } from "./payment-provider-type";

/**
 * Monedas ISO 4217 sin decimales (exponente 0). Todo el sistema guarda
 * `amount` como enteros asumiendo exactamente 2 decimales ("centavos") y
 * PayPalPaymentProvider.preparePayment convierte con `(amount / 100).toFixed(2)`
 * — para una moneda de 0 decimales eso cobraría 100 veces menos de lo debido
 * (1000 JPY guardados se enviarían como "10.00", no "1000"). No cubre el caso
 * inverso (monedas de 3 decimales, p. ej. BHD/KWD) por ser irrelevante para
 * el mercado objetivo actual (Colombia/EE.UU.).
 */
const PAYPAL_ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

/**
 * PayPal rechaza COP de forma real y documentada (CURRENCY_NOT_SUPPORTED,
 * confirmado empíricamente contra la API sandbox) — es una restricción de la
 * integración, no una preferencia de negocio, y no se resuelve con
 * conversión automática de moneda. El admin define la moneda de cada Price;
 * los proveedores disponibles se derivan de esa moneda, nunca al revés.
 */
export function isProviderCompatibleWithCurrency(provider: PaymentProviderType, currency: string): boolean {
  if (provider !== "PAYPAL") return true;
  if (currency === "COP") return false;
  if (PAYPAL_ZERO_DECIMAL_CURRENCIES.has(currency)) return false;
  return true;
}
