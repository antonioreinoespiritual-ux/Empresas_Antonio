import { z } from "zod";
import { DomainError } from "../shared/domain-error";
import type { PageKind } from "./page.entity";

// El contenido se guarda como JSON (Page.content) para permitir que el admin
// edite copy/textos sin migraciones; la forma sigue validada por "kind" acá,
// en domain, sin depender de Prisma/Next — evita tanto la rigidez de columnas
// por cada campo de marketing como un "content: any" sin ninguna garantía.

// ---------------------------------------------------------------------------
// LANDING: modelo de bloques estructurados (Frontend + Commerce Experience,
// Fase A). Cada bloque es una plantilla fija con sus propios campos — el
// admin arma la página eligiendo y ordenando bloques, nunca escribiendo HTML
// libre de la página completa (richText es la única excepción deliberada,
// acotada a un fragmento de copy suelto, igual de confiable que cualquier
// otro campo hoy: solo lo escribe un admin autenticado).
// id: identificador estable del bloque dentro de content.blocks[], requerido
// para que el Agent Access Layer pueda direccionar operaciones (editar/mover/
// eliminar un bloque puntual) sin depender de su posición en el array
// (ADR-04). Los bloques existentes en producción se completan con un script
// de backfill antes de que este campo pase a ser obligatorio en runtime.
const heroBlockSchema = z.object({
  type: z.literal("hero"),
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  backgroundImageUrl: z.string().url().optional(),
  ctaLabel: z.string().min(1).default("Comprar ahora"),
});

const vslBlockSchema = z.object({
  type: z.literal("vsl"),
  id: z.string().min(1),
  embedUrl: z.string().url(),
  posterImageUrl: z.string().url().optional(),
  autoplay: z.boolean().default(false),
});

const benefitsBlockSchema = z.object({
  type: z.literal("benefits"),
  id: z.string().min(1),
  heading: z.string().optional(),
  items: z
    .array(z.object({ icon: z.string().optional(), title: z.string().min(1), description: z.string().default("") }))
    .min(1),
});

const testimonialsBlockSchema = z.object({
  type: z.literal("testimonials"),
  id: z.string().min(1),
  heading: z.string().optional(),
  items: z
    .array(
      z.object({
        quote: z.string().min(1),
        authorName: z.string().min(1),
        authorRole: z.string().optional(),
        avatarUrl: z.string().url().optional(),
      })
    )
    .min(1),
});

const faqBlockSchema = z.object({
  type: z.literal("faq"),
  id: z.string().min(1),
  heading: z.string().optional(),
  items: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).min(1),
});

const guaranteeBlockSchema = z.object({
  type: z.literal("guarantee"),
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(""),
  badgeIcon: z.string().optional(),
});

const ctaBlockSchema = z.object({
  type: z.literal("cta"),
  id: z.string().min(1),
  headline: z.string().optional(),
  subtext: z.string().optional(),
  buttonLabel: z.string().min(1).default("Comprar ahora"),
});

const richTextBlockSchema = z.object({
  type: z.literal("richText"),
  id: z.string().min(1),
  html: z.string().min(1),
});

const landingBlockSchema = z.discriminatedUnion("type", [
  heroBlockSchema,
  vslBlockSchema,
  benefitsBlockSchema,
  testimonialsBlockSchema,
  faqBlockSchema,
  guaranteeBlockSchema,
  ctaBlockSchema,
  richTextBlockSchema,
]);
export type LandingBlock = z.infer<typeof landingBlockSchema>;
export type LandingBlockType = LandingBlock["type"];

const landingBlocksContentSchema = z.object({
  blocks: z.array(landingBlockSchema).min(1),
});

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

export type LandingPageContent = z.infer<typeof landingBlocksContentSchema> | LegacyLandingContent;

function hasBlocksShape(raw: unknown): boolean {
  return !!raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).blocks);
}

/**
 * Acepta y valida CUALQUIERA de las dos formas — no convierte una en otra.
 * La migración de datos existentes ocurre en lectura, bajo demanda, vía
 * `toLandingBlocks` (usado por el futuro renderer de bloques), nunca acá.
 */
function parseLandingPageContent(raw: unknown): LandingPageContent {
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
