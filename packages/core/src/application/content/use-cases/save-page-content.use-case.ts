import { parsePageContent, type PageKind } from "../../../domain";
import type { PageRepository } from "../ports/page-repository.port";

export interface SavePageContentDeps {
  pages: PageRepository;
}

export interface SavePageContentInput {
  offerId: string;
  kind: PageKind;
  slug?: string | null;
  content: unknown;
  /**
   * undefined = el llamador cree que esta Page no existe todavía (primer
   * guardado) — createInitial() falla si alguien más la creó primero.
   * Definida = version leída antes de escribir; base de la CAS
   * (updateWithVersion, Agent Access Layer, ADR-06).
   */
  expectedVersion?: number;
}

/**
 * Valida la forma del contenido contra el schema Zod correspondiente al
 * "kind" antes de persistir, y decide crear vs. actualizar-con-CAS según si
 * el llamador trae una version esperada. Nunca hace un upsert "a ciegas" —
 * eso es exactamente lo que la concurrencia optimista existe para evitar.
 */
export async function savePageContent(deps: SavePageContentDeps, input: SavePageContentInput) {
  const content = parsePageContent(input.kind, input.content);

  if (input.expectedVersion === undefined) {
    return deps.pages.createInitial({ offerId: input.offerId, kind: input.kind, slug: input.slug, content });
  }

  return deps.pages.updateWithVersion({
    offerId: input.offerId,
    kind: input.kind,
    slug: input.slug,
    content,
    expectedVersion: input.expectedVersion,
  });
}
