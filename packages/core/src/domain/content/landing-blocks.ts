import { z } from "zod";

// Extraído de page-content.ts para que `composition/node.ts` (nodo
// legacyBlock, ARCH-LANDING-EDITOR-02 §11) pueda reusar `landingBlockSchema`
// sin crear un import circular con page-content.ts (que a su vez importa el
// schema de Composition). page-content.ts re-exporta todo esto tal cual —
// ningún consumidor existente (block-operations.ts, block-type-catalog.ts,
// apps/agent-api) cambia su import.
//
// Modelo de bloques estructurados (Frontend + Commerce Experience, Fase A).
// Cada bloque es una plantilla fija con sus propios campos — el admin arma
// la página eligiendo y ordenando bloques, nunca escribiendo HTML libre de
// la página completa (richText es la única excepción deliberada, acotada a
// un fragmento de copy suelto, igual de confiable que cualquier otro campo
// hoy: solo lo escribe un admin autenticado).
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

export const landingBlockSchema = z.discriminatedUnion("type", [
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

export const landingBlocksContentSchema = z.object({
  blocks: z.array(landingBlockSchema).min(1),
});
