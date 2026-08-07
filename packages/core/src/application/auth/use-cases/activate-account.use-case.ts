import type { CustomerRepository } from "../../commerce/ports/customer-repository.port";

export interface ActivateAccountDeps {
  customers: CustomerRepository;
}

export interface ActivateAccountInput {
  customerId: string;
  userId: string;
}

/** Vincula Customer.user_id a un User existente o recién creado tras el pago (ADR Customer≠User). */
export async function activateAccount(_deps: ActivateAccountDeps, _input: ActivateAccountInput) {
  throw new Error("activateAccount: pendiente de Fase 1");
}
