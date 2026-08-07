export type OrderStatus = "PENDING" | "PAID" | "CANCELLED";

export interface OrderItem {
  id: string;
  orderId: string;
  offerId: string;
  priceId: string;
  amountSnapshot: number;
  currencySnapshot: string;
}

export interface Order {
  id: string;
  checkoutSessionId: string;
  customerId: string;
  status: OrderStatus;
  createdAt: Date;
}
