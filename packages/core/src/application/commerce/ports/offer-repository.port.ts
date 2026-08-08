import type { Offer, PaymentProviderType, Price, PriceInterval, ThemeId } from "../../../domain";

export interface OfferWithPrices extends Offer {
  prices: Price[];
}

export interface OfferListItem extends OfferWithPrices {
  productName: string;
}

export interface CreatePriceInput {
  amount: number;
  currency: string;
  interval: PriceInterval;
  /** Omitido o null = todos los proveedores compatibles con currency. */
  enabledProviders?: PaymentProviderType[] | null;
}

export interface CreateOfferInput {
  productId: string;
  name: string;
  validFrom?: Date | null;
  validTo?: Date | null;
  /** Omitido = DEFAULT_THEME_ID ("premium-light"). */
  themeId?: ThemeId;
  prices: CreatePriceInput[];
}

export interface UpdateOfferInput {
  name?: string;
  validFrom?: Date | null;
  validTo?: Date | null;
  themeId?: ThemeId;
}

export interface OfferRepository {
  findById(offerId: string): Promise<OfferWithPrices | null>;
  list(): Promise<OfferListItem[]>;
  create(input: CreateOfferInput): Promise<Offer>;
  update(offerId: string, input: UpdateOfferInput): Promise<Offer>;
  setActive(offerId: string, isActive: boolean): Promise<void>;
  addPrice(offerId: string, price: CreatePriceInput): Promise<Price>;
  removePrice(priceId: string): Promise<void>;
}
