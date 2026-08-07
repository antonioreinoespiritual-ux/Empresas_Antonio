export type PriceInterval = "ONE_TIME" | "RECURRING";

export interface Price {
  id: string;
  offerId: string;
  amount: number;
  currency: string;
  interval: PriceInterval;
}
