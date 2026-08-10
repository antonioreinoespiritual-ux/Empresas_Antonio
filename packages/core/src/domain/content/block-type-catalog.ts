import type { LandingBlockType } from "./page-content";

// Descripción estática de los 8 tipos de bloque de landingBlockSchema
// (page-content.ts) — colocada junto al schema Zod que describe, para que
// un cambio en uno se note si el otro no se actualiza en el mismo commit.
// Expuesta vía GET /block-types (F3 retrofit, PLAN-AGENT-API-01) para que
// un agente sepa qué forma debe tener cada bloque antes de intentar
// crear/editar uno (F4) — evita que tenga que adivinar el schema Zod.

export interface BlockTypeField {
  name: string;
  type: "string" | "boolean" | "url" | "array";
  required: boolean;
}

export interface BlockTypeDescriptor {
  type: LandingBlockType;
  fields: BlockTypeField[];
}

export const BLOCK_TYPE_CATALOG: readonly BlockTypeDescriptor[] = [
  {
    type: "hero",
    fields: [
      { name: "title", type: "string", required: true },
      { name: "subtitle", type: "string", required: false },
      { name: "backgroundImageUrl", type: "url", required: false },
      { name: "ctaLabel", type: "string", required: false },
    ],
  },
  {
    type: "vsl",
    fields: [
      { name: "embedUrl", type: "url", required: true },
      { name: "posterImageUrl", type: "url", required: false },
      { name: "autoplay", type: "boolean", required: false },
    ],
  },
  {
    type: "benefits",
    fields: [
      { name: "heading", type: "string", required: false },
      { name: "items", type: "array", required: true },
    ],
  },
  {
    type: "testimonials",
    fields: [
      { name: "heading", type: "string", required: false },
      { name: "items", type: "array", required: true },
    ],
  },
  {
    type: "faq",
    fields: [
      { name: "heading", type: "string", required: false },
      { name: "items", type: "array", required: true },
    ],
  },
  {
    type: "guarantee",
    fields: [
      { name: "title", type: "string", required: true },
      { name: "description", type: "string", required: false },
      { name: "badgeIcon", type: "string", required: false },
    ],
  },
  {
    type: "cta",
    fields: [
      { name: "headline", type: "string", required: false },
      { name: "subtext", type: "string", required: false },
      { name: "buttonLabel", type: "string", required: false },
    ],
  },
  {
    type: "richText",
    fields: [{ name: "html", type: "string", required: true }],
  },
] as const;
