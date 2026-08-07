export interface Offer {
  id: string;
  productId: string;
  campaignId: string | null;
  name: string;
  isActive: boolean;
  validFrom: Date | null;
  validTo: Date | null;
}
