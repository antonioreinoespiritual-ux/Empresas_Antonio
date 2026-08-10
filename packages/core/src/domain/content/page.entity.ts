export type PageKind = "LANDING" | "CHECKOUT" | "THANK_YOU";
export type PageStatus = "DRAFT" | "PUBLISHED";

export interface Page {
  id: string;
  offerId: string;
  kind: PageKind;
  slug: string | null;
  status: PageStatus;
  content: unknown;
  // Contador de concurrencia optimista (Agent Access Layer — ADR-06). El
  // compare-and-swap atómico en la escritura es responsabilidad del
  // repositorio, no de esta entidad; acá solo se expone el valor actual.
  version: number;
  updatedAt: Date;
}
