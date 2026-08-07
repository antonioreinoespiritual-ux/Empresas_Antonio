import type { CustomerDetail, CustomerListItem, CustomerRepository } from "../../../application";
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

  async list(): Promise<CustomerListItem[]> {
    const customers = await prisma.customer.findMany({
      include: { _count: { select: { orders: true } } },
      orderBy: { createdAt: "desc" },
    });

    return customers.map(({ _count, ...customer }) => ({ ...customer, ordersCount: _count.orders }));
  }

  async findDetailById(customerId: string): Promise<CustomerDetail | null> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        orders: {
          include: { items: { include: { offer: { select: { name: true } } } } },
          orderBy: { createdAt: "desc" },
        },
        entitlements: { include: { product: { select: { name: true } } } },
      },
    });
    if (!customer) return null;

    const { orders, entitlements, ...rest } = customer;
    return {
      ...rest,
      orders: orders.map((order) => ({
        id: order.id,
        customerEmail: rest.email,
        offerName: order.items[0]?.offer.name ?? "—",
        status: order.status,
        totalAmount: order.items.reduce((sum, item) => sum + item.amountSnapshot, 0),
        currency: order.items[0]?.currencySnapshot ?? "COP",
        createdAt: order.createdAt,
      })),
      entitlements: entitlements.map((entitlement) => ({
        id: entitlement.id,
        productName: entitlement.product.name,
        status: entitlement.status,
      })),
    };
  }
}
