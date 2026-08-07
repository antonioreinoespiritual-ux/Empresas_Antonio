import { parsePageContent, type PageKind } from "../../../domain";
import type { PageRepository } from "../ports/page-repository.port";

export interface UpsertPageContentDeps {
  pages: PageRepository;
}

export interface UpsertPageContentInput {
  offerId: string;
  kind: PageKind;
  slug?: string | null;
  content: unknown;
}

/**
 * Valida la forma del contenido contra el schema Zod correspondiente al
 * "kind" antes de persistir — es la única razón por la que esto es un caso
 * de uso y no un simple repository.upsert directo desde la acción del admin.
 */
export async function upsertPageContent(deps: UpsertPageContentDeps, input: UpsertPageContentInput) {
  const content = parsePageContent(input.kind, input.content);
  return deps.pages.upsert({
    offerId: input.offerId,
    kind: input.kind,
    slug: input.slug,
    content,
  });
}
