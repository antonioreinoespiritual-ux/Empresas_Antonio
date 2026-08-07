import type { CustomerRepository } from "../../../application";
import { prisma } from "../client";

export class PrismaCustomerRepository implements CustomerRepository {
  async findByEmail(email: string) {
    return prisma.customer.findUnique({ where: { email } });
  }

  async create(input: { email: string; name?: string | null }) {
    return prisma.customer.create({ data: { email: input.email, name: input.name ?? null } });
  }

  async linkToUser(customerId: string, userId: string): Promise<void> {
    await prisma.customer.update({ where: { id: customerId }, data: { userId } });
  }
}
