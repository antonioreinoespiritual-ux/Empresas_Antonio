import type { Customer } from "../../../domain";

export interface CustomerRepository {
  findByEmail(email: string): Promise<Customer | null>;
  create(input: { email: string; name?: string | null }): Promise<Customer>;
  linkToUser(customerId: string, userId: string): Promise<void>;
}
