export type PageKind = "LANDING" | "CHECKOUT" | "THANK_YOU";
export type PageStatus = "DRAFT" | "PUBLISHED";

export interface Page {
  id: string;
  offerId: string;
  kind: PageKind;
  slug: string | null;
  status: PageStatus;
  content: unknown;
  updatedAt: Date;
}
