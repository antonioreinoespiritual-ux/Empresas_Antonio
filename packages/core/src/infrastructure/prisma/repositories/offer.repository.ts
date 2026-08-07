import type { CreateOfferInput, CreatePriceInput, OfferRepository, UpdateOfferInput } from "../../../application";
import { prisma } from "../client";

export class PrismaOfferRepository implements OfferRepository {
  async findById(offerId: string) {
    return prisma.offer.findUnique({ where: { id: offerId }, include: { prices: true } });
  }

  async list() {
    const offers = await prisma.offer.findMany({
      include: { prices: true, product: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return offers.map(({ product, ...offer }) => ({ ...offer, productName: product.name }));
  }

  async create(input: CreateOfferInput) {
    return prisma.offer.create({
      data: {
        productId: input.productId,
        name: input.name,
        validFrom: input.validFrom ?? null,
        validTo: input.validTo ?? null,
        prices: { create: input.prices },
      },
    });
  }

  async update(offerId: string, input: UpdateOfferInput) {
    return prisma.offer.update({ where: { id: offerId }, data: input });
  }

  async setActive(offerId: string, isActive: boolean): Promise<void> {
    await prisma.offer.update({ where: { id: offerId }, data: { isActive } });
  }

  async addPrice(offerId: string, price: CreatePriceInput) {
    return prisma.price.create({ data: { offerId, ...price } });
  }

  async removePrice(priceId: string): Promise<void> {
    await prisma.price.delete({ where: { id: priceId } });
  }
}
