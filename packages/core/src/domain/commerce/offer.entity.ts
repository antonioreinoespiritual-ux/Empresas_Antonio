import { DomainError } from "../shared/domain-error";

export interface Offer {
  id: string;
  productId: string;
  campaignId: string | null;
  name: string;
  isActive: boolean;
  validFrom: Date | null;
  validTo: Date | null;
}

export function assertOfferIsSellable(offer: Offer, now: Date = new Date()): void {
  if (!offer.isActive) {
    throw new DomainError(`Offer ${offer.id} no está activa`);
  }
  if (offer.validFrom && now < offer.validFrom) {
    throw new DomainError(`Offer ${offer.id} aún no está disponible`);
  }
  if (offer.validTo && now > offer.validTo) {
    throw new DomainError(`Offer ${offer.id} ya no está disponible`);
  }
}
