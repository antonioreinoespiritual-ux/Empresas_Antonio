import { DomainError } from "../shared/domain-error";
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

/** Único lugar que enumera los proveedores existentes — evita listas duplicadas en UI/dominio. */
export const ALL_PAYMENT_PROVIDERS: PaymentProviderType[] = ["WOMPI", "PAYPAL"];

export function compatibleProviders(currency: string): PaymentProviderType[] {
  return ALL_PAYMENT_PROVIDERS.filter((provider) => isProviderCompatibleWithCurrency(provider, currency));
}

/**
 * Fuente de verdad final de qué proveedores se pueden ofrecer para un Price:
 * compatibleProviders(currency) ∩ enabledProviders. `enabledProviders: null`
 * significa "todos los compatibles" (comportamiento por defecto, sin
 * restricción del admin). enabledProviders SOLO puede restringir el
 * conjunto técnicamente compatible — nunca ampliarlo: un proveedor
 * incompatible con la moneda jamás aparece acá aunque se lo intente forzar.
 */
export function getAvailableProviders(
  currency: string,
  enabledProviders: PaymentProviderType[] | null
): PaymentProviderType[] {
  const compatible = compatibleProviders(currency);
  if (enabledProviders === null) return compatible;
  return compatible.filter((provider) => enabledProviders.includes(provider));
}

/**
 * Guardia de escritura: valida que un `enabledProviders` propuesto (p. ej. al
 * crear/editar un Price desde admin) sea un subconjunto válido de los
 * proveedores compatibles con `currency`. Se llama en la capa de repositorio
 * — server-side, autoritativa — para que un payload manipulado no pueda
 * persistir un proveedor incompatible aunque la UI lo hubiera evitado.
 */
export function assertEnabledProvidersAreCompatible(
  currency: string,
  enabledProviders: PaymentProviderType[] | null
): void {
  if (enabledProviders === null) return;
  const compatible = compatibleProviders(currency);
  const invalid = enabledProviders.filter((provider) => !compatible.includes(provider));
  if (invalid.length > 0) {
    throw new DomainError(
      `enabledProviders inválido para ${currency}: ${invalid.join(", ")} no es compatible con esta moneda`
    );
  }
}
