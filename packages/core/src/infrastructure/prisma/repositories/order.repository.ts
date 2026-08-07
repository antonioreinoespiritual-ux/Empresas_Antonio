import type { OrderDetail, OrderListItem, OrderRepository } from "../../../application";
import type { Order } from "../../../domain";
import { prisma } from "../client";
import { isUniqueConstraintViolation } from "../is-unique-constraint-violation";

export class PrismaOrderRepository implements OrderRepository {
  async findByCheckoutSessionId(checkoutSessionId: string) {
    return prisma.order.findUnique({ where: { checkoutSessionId } });
  }

  async createFromCheckoutSession(checkoutSessionId: string): Promise<Order> {
    const existing = await prisma.order.findUnique({ where: { checkoutSessionId } });
    if (existing) return existing;

    const checkoutSession = await prisma.checkoutSession.findUniqueOrThrow({
      where: { id: checkoutSessionId },
      include: { price: true },
    });

    try {
      return await prisma.order.create({
        data: {
          checkoutSessionId,
          customerId: checkoutSession.customerId,
          items: {
            create: {
              offerId: checkoutSession.offerId,
              priceId: checkoutSession.priceId,
              amountSnapshot: checkoutSession.price.amount,
              currencySnapshot: checkoutSession.price.currency,
            },
          },
        },
      });
    } catch (error) {
      // Carrera entre dos procesamientos concurrentes del mismo CheckoutSession:
      // el UNIQUE en checkoutSessionId ya protegió la duplicidad, solo la recuperamos.
      if (isUniqueConstraintViolation(error)) {
        return prisma.order.findUniqueOrThrow({ where: { checkoutSessionId } });
      }
      throw error;
    }
  }

  async markAsPaid(orderId: string): Promise<void> {
    await prisma.order.update({ where: { id: orderId }, data: { status: "PAID" } });
  }

  async markAsCancelled(orderId: string): Promise<void> {
    // Guard por status: un DECLINED tardío o fuera de orden nunca debe
    // regresar un Order que ya fue pagado por un intento posterior.
    await prisma.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "CANCELLED" } });
  }

  async list(): Promise<OrderListItem[]> {
    const orders = await prisma.order.findMany({
      include: {
        customer: { select: { email: true } },
        items: { include: { offer: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return orders.map((order) => ({
      id: order.id,
      customerEmail: order.customer.email,
      offerName: order.items[0]?.offer.name ?? "—",
      status: order.status,
      totalAmount: order.items.reduce((sum, item) => sum + item.amountSnapshot, 0),
      currency: order.items[0]?.currencySnapshot ?? "COP",
      createdAt: order.createdAt,
    }));
  }

  async findDetailById(orderId: string): Promise<OrderDetail | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { email: true } },
        items: { include: { offer: { select: { name: true } } } },
        payments: true,
        entitlements: { include: { product: { select: { name: true } } } },
      },
    });
    if (!order) return null;

    return {
      id: order.id,
      checkoutSessionId: order.checkoutSessionId,
      customerId: order.customerId,
      status: order.status,
      createdAt: order.createdAt,
      customerEmail: order.customer.email,
      items: order.items.map((item) => ({
        id: item.id,
        offerName: item.offer.name,
        amountSnapshot: item.amountSnapshot,
        currencySnapshot: item.currencySnapshot,
      })),
      payments: order.payments.map((payment) => ({
        id: payment.id,
        provider: payment.provider,
        providerReference: payment.providerReference,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        createdAt: payment.createdAt,
      })),
      entitlements: order.entitlements.map((entitlement) => ({
        id: entitlement.id,
        productName: entitlement.product.name,
        status: entitlement.status,
      })),
    };
  }
}
