import type { CustomerRepository } from "../ports/customer-repository.port";
import type { CheckoutSessionRepository } from "../ports/checkout-session-repository.port";

export interface StartCheckoutDeps {
  customers: CustomerRepository;
  checkoutSessions: CheckoutSessionRepository;
}

export interface StartCheckoutInput {
  offerId: string;
  guestEmail: string;
}

/**
 * Crea/encuentra Customer por email (sin password, sin cuenta) y abre un
 * CheckoutSession — nunca exige User/login previo.
 */
export async function startCheckout(_deps: StartCheckoutDeps, _input: StartCheckoutInput) {
  throw new Error("startCheckout: pendiente de Fase 1");
}
