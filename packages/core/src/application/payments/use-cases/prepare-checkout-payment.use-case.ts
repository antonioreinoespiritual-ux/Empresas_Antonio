import { DomainError, NotFoundError, type PaymentProviderType } from "../../../domain";
import type { CheckoutSessionRepository } from "../../commerce/ports/checkout-session-repository.port";
import type { OfferRepository } from "../../commerce/ports/offer-repository.port";
import type { PaymentProvider, PreparedPayment } from "../ports/payment-provider.port";

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
 * Fija el proveedor elegido por el comprador en el CheckoutSession y delega
 * en el PaymentProvider correspondiente (Wompi/PayPal) la preparación del
 * pago con el monto/moneda congelados desde la Offer/Price vigente.
 */
export async function prepareCheckoutPayment(
  deps: PrepareCheckoutPaymentDeps,
  input: PrepareCheckoutPaymentInput
): Promise<PreparedPayment> {
  const checkoutSession = await deps.checkoutSessions.findById(input.checkoutSessionId);
  if (!checkoutSession) {
    throw new NotFoundError(`CheckoutSession ${input.checkoutSessionId} no existe`);
  }
  if (checkoutSession.status !== "STARTED") {
    throw new DomainError(`CheckoutSession ${input.checkoutSessionId} ya no acepta pagos`);
  }

  const offer = await deps.offers.findById(checkoutSession.offerId);
  const price = offer?.prices.find((candidate) => candidate.id === checkoutSession.priceId);
  if (!offer || !price) {
    throw new NotFoundError(`Offer/Price de la CheckoutSession ${input.checkoutSessionId} no existen`);
  }

  await deps.checkoutSessions.setProvider(input.checkoutSessionId, input.provider);

  const provider = deps.providers[input.provider];
  return provider.preparePayment({
    checkoutSessionId: input.checkoutSessionId,
    amount: price.amount,
    currency: price.currency,
  });
}
