import { z } from "zod";
import { DomainError } from "../shared/domain-error";
import type { PageKind } from "./page.entity";

// El contenido se guarda como JSON (Page.content) para permitir que el admin
// edite copy/textos sin migraciones; la forma sigue validada por "kind" acá,
// en domain, sin depender de Prisma/Next — evita tanto la rigidez de columnas
// por cada campo de marketing como un "content: any" sin ninguna garantía.

export const landingPageContentSchema = z.object({
  heroTitle: z.string().min(1),
  heroSubtitle: z.string().default(""),
  vslEmbedUrl: z.string().url().optional(),
  bodyHtml: z.string().default(""),
  ctaLabel: z.string().min(1).default("Comprar ahora"),
});
export type LandingPageContent = z.infer<typeof landingPageContentSchema>;

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
      return landingPageContentSchema.parse(raw);
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
