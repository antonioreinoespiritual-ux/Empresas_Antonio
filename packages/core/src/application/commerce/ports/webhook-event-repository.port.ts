import type { PaymentProviderType } from "../../../domain";

export interface WebhookEventRepository {
  /** Devuelve false si (provider, providerEventId) ya existía — evento duplicado. */
  registerIfNew(provider: PaymentProviderType, providerEventId: string): Promise<boolean>;
  markProcessed(provider: PaymentProviderType, providerEventId: string): Promise<void>;
}
