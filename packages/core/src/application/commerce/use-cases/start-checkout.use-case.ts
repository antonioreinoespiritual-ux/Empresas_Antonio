import { assertOfferIsSellable, DomainError, NotFoundError } from "../../../domain";
import type { CustomerRepository } from "../ports/customer-repository.port";
import type { CheckoutSessionRepository } from "../ports/checkout-session-repository.port";
import type { OfferRepository } from "../ports/offer-repository.port";

export interface StartCheckoutDeps {
  customers: CustomerRepository;
  checkoutSessions: CheckoutSessionRepository;
  offers: OfferRepository;
}

export interface StartCheckoutInput {
  offerId: string;
  priceId: string;
  guestEmail: string;
}

/**
 * Crea/encuentra Customer por email (sin password, sin cuenta) y abre un
 * CheckoutSession — nunca exige User/login previo.
 */
export async function startCheckout(deps: StartCheckoutDeps, input: StartCheckoutInput) {
  const offer = await deps.offers.findById(input.offerId);
  if (!offer) {
    throw new NotFoundError(`Offer ${input.offerId} no existe`);
  }
  assertOfferIsSellable(offer);

  const price = offer.prices.find((candidate) => candidate.id === input.priceId);
  if (!price) {
    throw new DomainError(`Price ${input.priceId} no pertenece a la Offer ${input.offerId}`);
  }

  const customer =
    (await deps.customers.findByEmail(input.guestEmail)) ??
    (await deps.customers.create({ email: input.guestEmail }));

  return deps.checkoutSessions.create({
    offerId: input.offerId,
    priceId: input.priceId,
    customerId: customer.id,
  });
}
