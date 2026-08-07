import type { PaymentProviderType } from "../payments/payment-provider-type";

export type PriceInterval = "ONE_TIME" | "RECURRING";

export interface Price {
  id: string;
  offerId: string;
  amount: number;
  currency: string;
  interval: PriceInterval;
  /** null = todos los proveedores técnicamente compatibles con currency (ver getAvailableProviders). */
  enabledProviders: PaymentProviderType[] | null;
}
