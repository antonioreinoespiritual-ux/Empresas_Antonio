import type { OfferRepository } from "../../../application";
import { prisma } from "../client";

export class PrismaOfferRepository implements OfferRepository {
  async findById(offerId: string) {
    return prisma.offer.findUnique({ where: { id: offerId }, include: { prices: true } });
  }
}
