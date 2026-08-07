import type { PaymentProviderType } from "../../../domain";
import type { CheckoutSessionRepository } from "../../commerce/ports/checkout-session-repository.port";
import type { OfferRepository } from "../../commerce/ports/offer-repository.port";
import type { PaymentProvider } from "../ports/payment-provider.port";

export interface PrepareCheckoutPaymentDeps {
  checkoutSessions: CheckoutSessionRepository;
  offers: OfferRepository;
  providers: Record<PaymentProviderType, PaymentProvider>;
}

export interface PrepareCheckoutPaymentInput {
  checkoutSessionId: string;
  provider: PaymentProviderType;
}

/**
 * Fase 1: resolver la Offer/Price vigente del CheckoutSession, fijar el
 * proveedor elegido y delegar en el PaymentProvider correspondiente.
 */
export async function prepareCheckoutPayment(
  _deps: PrepareCheckoutPaymentDeps,
  _input: PrepareCheckoutPaymentInput
) {
  throw new Error("prepareCheckoutPayment: pendiente de Fase 1");
}
