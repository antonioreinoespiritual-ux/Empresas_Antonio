import type { PaymentProviderType } from "./payment-provider-type";

/**
 * PayPal rechaza COP de forma real y documentada (CURRENCY_NOT_SUPPORTED,
 * confirmado empíricamente contra la API sandbox) — es una restricción de la
 * integración, no una preferencia de negocio, y no se resuelve con
 * conversión automática de moneda. El admin define la moneda de cada Price;
 * los proveedores disponibles se derivan de esa moneda, nunca al revés.
 */
export function isProviderCompatibleWithCurrency(provider: PaymentProviderType, currency: string): boolean {
  if (provider === "PAYPAL" && currency === "COP") return false;
  return true;
}
