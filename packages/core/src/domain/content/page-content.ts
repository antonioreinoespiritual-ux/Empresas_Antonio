import { z } from "zod";
import { DomainError } from "../shared/domain-error";
import type { PageKind } from "./page.entity";
import { compositionContentSchema, type CompositionContent } from "./composition/node";
import { landingBlocksContentSchema, type LandingBlock } from "./landing-blocks";

// El contenido se guarda como JSON (Page.content) para permitir que el admin
// edite copy/textos sin migraciones; la forma sigue validada por "kind" acá,
// en domain, sin depender de Prisma/Next — evita tanto la rigidez de columnas
// por cada campo de marketing como un "content: any" sin ninguna garantía.
//
// Los 8 LandingBlock (hero/vsl/benefits/testimonials/faq/guarantee/cta/
// richText) viven en `./landing-blocks` (no acá) para que
// `composition/node.ts` pueda reusar `landingBlockSchema` en su nodo
// `legacyBlock` sin crear un import circular con este archivo. Se
// re-exportan tal cual más abajo — ningún consumidor existente cambia.
export { landingBlockSchema, landingBlocksContentSchema, type LandingBlock, type LandingBlockType } from "./landing-blocks";

// Formato previo a los bloques (campos sueltos). Se sigue aceptando en
// lectura Y escritura sin cambios: la UI de admin todavía lo produce hasta
// que el editor de bloques (Fase B) reemplace el formulario actual, así que
// migrar en escritura acá rompería el renderizado público de /[slug] (que
// todavía no lee `blocks`, eso es Fase C). bodyHtml nunca se elimina hasta
// que exista un renderer no destructivo para lo que ya está guardado así.
const legacyLandingContentSchema = z.object({
  heroTitle: z.string().min(1),
  heroSubtitle: z.string().default(""),
  vslEmbedUrl: z.string().url().optional(),
  bodyHtml: z.string().default(""),
  ctaLabel: z.string().min(1).default("Comprar ahora"),
});
export type LegacyLandingContent = z.infer<typeof legacyLandingContentSchema>;

export type LandingPageContent = z.infer<typeof landingBlocksContentSchema> | LegacyLandingContent | CompositionContent;

function hasBlocksShape(raw: unknown): boolean {
  return !!raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).blocks);
}

// "composition-1" es un marcador que ninguna Page legacy/blocks existente
// puede tener (ver ARCH-LANDING-EDITOR-02) — cero riesgo de reclasificar
// contenido real ya guardado en cualquiera de las otras dos formas.
function hasCompositionShape(raw: unknown): boolean {
  return !!raw && typeof raw === "object" && (raw as Record<string, unknown>).version === "composition-1";
}

/**
 * Acepta y valida CUALQUIERA de las tres formas — no convierte una en otra.
 * La migración de datos existentes ocurre en lectura, bajo demanda, vía
 * `toLandingBlocks` (usado por el renderer de bloques legacy/blocks), nunca
 * acá. Composition (árbol de nodos) es un formato aparte, sin proyección a
 * LandingBlock[] — tiene su propio renderer (ARCH-LANDING-EDITOR-02 Fase 2).
 */
function parseLandingPageContent(raw: unknown): LandingPageContent {
  if (hasCompositionShape(raw)) {
    return compositionContentSchema.parse(raw);
  }
  if (hasBlocksShape(raw)) {
    return landingBlocksContentSchema.parse(raw);
  }
  return legacyLandingContentSchema.parse(raw);
}

/**
 * Vista normalizada en bloques de un LandingPageContent, sin importar en qué
 * formato esté guardado. No escribe nada — es una proyección de lectura.
 * bodyHtml se conserva íntegro como bloque richText: cero pérdida de copy ya
 * publicado.
 */
export function toLandingBlocks(content: LandingPageContent): LandingBlock[] {
  if ("blocks" in content) {
    return content.blocks;
  }
  if ("version" in content) {
    // Composition no es una lista plana de bloques — no hay proyección con
    // sentido a LandingBlock[]. Sin este chequeo, el resto de esta función
    // accedería a campos legacy (heroTitle/bodyHtml) que no existen en
    // CompositionContent y fallaría con un error confuso en vez de uno claro.
    throw new DomainError("toLandingBlocks no aplica a contenido en formato composition-1");
  }
  // ids fijos y deterministas (no crypto.randomUUID()): esta proyección corre
  // en cada lectura, y un id que cambiara entre llamadas rompería cualquier
  // referencia a un bloque puntual tomada en una lectura anterior.
  const blocks: LandingBlock[] = [
    {
      type: "hero",
      id: "legacy-hero",
      title: content.heroTitle,
      subtitle: content.heroSubtitle || undefined,
      ctaLabel: content.ctaLabel,
    },
  ];
  if (content.vslEmbedUrl) {
    blocks.push({ type: "vsl", id: "legacy-vsl", embedUrl: content.vslEmbedUrl, autoplay: false });
  }
  if (content.bodyHtml) {
    blocks.push({ type: "richText", id: "legacy-richtext", html: content.bodyHtml });
  }
  return blocks;
}

// ---------------------------------------------------------------------------

export const checkoutPageContentSchema = z.object({
  headline: z.string().default(""),
  subheadline: z.string().default(""),
});
export type CheckoutPageContent = z.infer<typeof checkoutPageContentSchema>;

export const thankYouPageContentSchema = z.object({
  title: z.string().min(1).default("¡Gracias por tu compra!"),
  message: z.string().default(""),
  videoUrl: z.string().url().optional(),
});
export type ThankYouPageContent = z.infer<typeof thankYouPageContentSchema>;

export function parsePageContent(kind: PageKind, raw: unknown) {
  switch (kind) {
    case "LANDING":
      return parseLandingPageContent(raw);
    case "CHECKOUT":
      return checkoutPageContentSchema.parse(raw);
    case "THANK_YOU":
      return thankYouPageContentSchema.parse(raw);
    default: {
      const exhaustive: never = kind;
      throw new DomainError(`PageKind desconocido: ${exhaustive}`);
    }
  }
}
