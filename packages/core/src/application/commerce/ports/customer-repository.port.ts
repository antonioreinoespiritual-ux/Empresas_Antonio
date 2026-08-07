import type { Customer, EntitlementStatus } from "../../../domain";
import type { OrderListItem } from "./order-repository.port";

export interface CustomerListItem extends Customer {
  ordersCount: number;
}

export interface CustomerDetail extends Customer {
  orders: OrderListItem[];
  entitlements: { id: string; productName: string; status: EntitlementStatus }[];
}

export interface CustomerRepository {
  findByEmail(email: string): Promise<Customer | null>;
  create(input: { email: string; name?: string | null }): Promise<Customer>;
  linkToUser(customerId: string, userId: string): Promise<void>;
  list(): Promise<CustomerListItem[]>;
  findDetailById(customerId: string): Promise<CustomerDetail | null>;
}
