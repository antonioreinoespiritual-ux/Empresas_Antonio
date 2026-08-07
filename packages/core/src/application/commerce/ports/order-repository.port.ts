import type { Order } from "../../../domain";

export interface OrderRepository {
  findByCheckoutSessionId(checkoutSessionId: string): Promise<Order | null>;
  createFromCheckoutSession(checkoutSessionId: string): Promise<Order>;
}
