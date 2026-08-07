import type { Order } from "../../../domain";

export interface OrderRepository {
  findByCheckoutSessionId(checkoutSessionId: string): Promise<Order | null>;
  /** Idempotente: si ya existe un Order para el CheckoutSession, lo devuelve sin duplicar. */
  createFromCheckoutSession(checkoutSessionId: string): Promise<Order>;
  markAsPaid(orderId: string): Promise<void>;
}
