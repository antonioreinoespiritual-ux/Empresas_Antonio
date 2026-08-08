import { DomainError } from "../shared/domain-error";
import type { ThemeId } from "../content/theme-id";

export interface Offer {
  id: string;
  productId: string;
  campaignId: string | null;
  name: string;
  isActive: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  /** Controla la piel visual de LANDING/CHECKOUT/THANK_YOU de esta Offer — nunca CSS libre, siempre uno de los presets cerrados. */
  themeId: ThemeId;
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
