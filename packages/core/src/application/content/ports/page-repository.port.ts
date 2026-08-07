import type { Page, PageKind, PageStatus } from "../../../domain";

export interface UpsertPageInput {
  offerId: string;
  kind: PageKind;
  slug?: string | null;
  content: unknown;
}

export interface PageRepository {
  findByOfferAndKind(offerId: string, kind: PageKind): Promise<Page | null>;
  findPublishedBySlug(slug: string): Promise<Page | null>;
  upsert(input: UpsertPageInput): Promise<Page>;
  setStatus(pageId: string, status: PageStatus): Promise<void>;
}
