import type { Offer, Price } from "../../../domain";

export interface OfferRepository {
  findById(offerId: string): Promise<(Offer & { prices: Price[] }) | null>;
}
