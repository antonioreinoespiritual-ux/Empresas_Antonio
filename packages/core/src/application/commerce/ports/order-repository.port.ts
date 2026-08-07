import type { EntitlementStatus, Order, OrderStatus, PaymentProviderType, PaymentStatus } from "../../../domain";

export interface OrderListItem {
  id: string;
  customerEmail: string;
  offerName: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  createdAt: Date;
}

export interface OrderDetail extends Order {
  customerEmail: string;
  items: { id: string; offerName: string; amountSnapshot: number; currencySnapshot: string }[];
  payments: {
    id: string;
    provider: PaymentProviderType;
    providerReference: string;
    status: PaymentStatus;
    amount: number;
    currency: string;
    createdAt: Date;
  }[];
  entitlements: { id: string; productName: string; status: EntitlementStatus }[];
}

export interface OrderRepository {
  findByCheckoutSessionId(checkoutSessionId: string): Promise<Order | null>;
  /** Idempotente: si ya existe un Order para el CheckoutSession, lo devuelve sin duplicar. */
  createFromCheckoutSession(checkoutSessionId: string): Promise<Order>;
  markAsPaid(orderId: string): Promise<void>;
  /** No-op si el Order ya no está PENDING (nunca regresa un Order ya PAID). */
  markAsCancelled(orderId: string): Promise<void>;
  list(): Promise<OrderListItem[]>;
  findDetailById(orderId: string): Promise<OrderDetail | null>;
}
