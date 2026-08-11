import { z } from "zod";
import { landingBlockSchema } from "../landing-blocks";
import { richTextDocSchema } from "./rich-text";
import { safeLinkUrlSchema } from "./safe-url";
import { stylePropsSchema } from "./style-tokens";

// Árbol de nodos de Composition (ARCH-LANDING-EDITOR-02 §4/§8). Generaliza el
// array plano de LandingBlock a una jerarquía section → row → elemento, con
// como máximo un nivel extra de row anidada dentro de otra row (decisión
// P-1, aprobada por Antonio: profundidad máxima = 4 niveles). Esa cota no es
// un chequeo aparte que camine el árbol — es una garantía estructural del
// propio schema: `innerRowNodeSchema` (fila anidada) solo puede tener
// elementos como hijos, nunca otra fila, así que Zod rechaza un 5º nivel en
// el momento del parse, no en un paso de validación posterior.
const nodeIdSchema = z.string().min(1);

// ---------------------------------------------------------------------------
// Nodos elemento (hoja, sin children). Cada uno con su propio `content`
// cerrado por Zod — nunca un campo `html`/`css`/`script` libre.

const richTextNodeSchema = z.object({
  type: z.literal("richText"),
  id: nodeIdSchema,
  style: stylePropsSchema.optional(),
  content: richTextDocSchema,
});

const imageNodeSchema = z.object({
  type: z.literal("image"),
  id: nodeIdSchema,
  style: stylePropsSchema.optional(),
  content: z.object({ assetId: z.string().min(1), altText: z.string().min(1) }),
});

const videoSourceSchema = z.union([
  z.object({ kind: z.literal("embed"), embedUrl: z.string().url() }),
  z.object({ kind: z.literal("asset"), assetId: z.string().min(1), posterAssetId: z.string().min(1).optional() }),
]);

const videoNodeSchema = z.object({
  type: z.literal("video"),
  id: nodeIdSchema,
  style: stylePropsSchema.optional(),
  content: z.object({ source: videoSourceSchema, autoplay: z.boolean().default(false) }),
});

const galleryNodeSchema = z.object({
  type: z.literal("gallery"),
  id: nodeIdSchema,
  style: stylePropsSchema.optional(),
  content: z.object({
    items: z.array(z.object({ assetId: z.string().min(1), altText: z.string().min(1) })).min(1),
  }),
});

// Nombre libre (mismo criterio ya usado hoy en `benefitsBlockSchema.items[].icon`
// de page-content.ts, no un catálogo cerrado) — resolver el nombre a un ícono
// real es responsabilidad del renderer (Fase 2), no del dominio.
const iconNodeSchema = z.object({
  type: z.literal("icon"),
  id: nodeIdSchema,
  style: stylePropsSchema.optional(),
  content: z.object({ name: z.string().min(1) }),
});

const dividerNodeSchema = z.object({
  type: z.literal("divider"),
  id: nodeIdSchema,
  style: stylePropsSchema.optional(),
  content: z.object({}),
});

const buttonNodeSchema = z.object({
  type: z.literal("button"),
  id: nodeIdSchema,
  style: stylePropsSchema.optional(),
  content: z.object({ label: z.string().min(1), href: safeLinkUrlSchema }),
});

// El alto lo controla `style.spacing` (token, no un número libre) — content
// vacío es deliberado, no un placeholder.
const spacerNodeSchema = z.object({
  type: z.literal("spacer"),
  id: nodeIdSchema,
  style: stylePropsSchema.optional(),
  content: z.object({}),
});

const shapeNodeSchema = z.object({
  type: z.literal("shape"),
  id: nodeIdSchema,
  style: stylePropsSchema.optional(),
  content: z.object({ variant: z.enum(["dot", "line", "blob"]) }),
});

// Envuelve 1 de los 8 LandingBlock existentes tal cual, reusando su schema y
// su componente de render sin cambios (ARCH-LANDING-EDITOR-02 §11) — así un
// `hero`/`vsl`/etc. clásico puede convivir dentro de una Composition nueva.
// Sin `style` propio: el bloque legacy ya gestiona su propia apariencia.
const legacyBlockNodeSchema = z.object({
  type: z.literal("legacyBlock"),
  id: nodeIdSchema,
  content: z.object({ block: landingBlockSchema }),
});

const elementNodeSchema = z.discriminatedUnion("type", [
  richTextNodeSchema,
  imageNodeSchema,
  videoNodeSchema,
  galleryNodeSchema,
  iconNodeSchema,
  dividerNodeSchema,
  buttonNodeSchema,
  spacerNodeSchema,
  shapeNodeSchema,
  legacyBlockNodeSchema,
]);
export type ElementNode = z.infer<typeof elementNodeSchema>;
export type ElementNodeType = ElementNode["type"];

// ---------------------------------------------------------------------------
// Nodos contenedor. `innerRowNodeSchema` es la fila anidada de nivel 3→4: sus
// hijos son solo elementos, nunca otra fila — es la mitad de la garantía de
// profundidad máxima descrita arriba.

const innerRowNodeSchema = z.object({
  type: z.literal("row"),
  id: nodeIdSchema,
  style: stylePropsSchema.optional(),
  children: z.array(elementNodeSchema).min(1),
});
export type InnerRowNode = z.infer<typeof innerRowNodeSchema>;

// `rowNodeSchema` es la fila de nivel 2: sus hijos pueden ser elementos o,
// como máximo un nivel más, otra fila (`innerRowNodeSchema`) — nunca una
// `section`. Cada hijo directo de una row es, conceptualmente, una columna;
// no existe un tipo de nodo "column" separado — el ancho de columna es
// `style.layout.columnSpan` (1-12) del propio hijo (§8).
const rowNodeSchema = z.object({
  type: z.literal("row"),
  id: nodeIdSchema,
  style: stylePropsSchema.optional(),
  children: z.array(z.union([elementNodeSchema, innerRowNodeSchema])).min(1),
});
export type RowNode = z.infer<typeof rowNodeSchema>;

// `sectionNodeSchema` es el nivel 1, y el único tipo de nodo válido en la
// raíz de una Composition — siempre contiene filas, nunca elementos sueltos
// directamente (mantiene la jerarquía section→row→elemento explícita en vez
// de opcional).
const sectionNodeSchema = z.object({
  type: z.literal("section"),
  id: nodeIdSchema,
  style: stylePropsSchema.optional(),
  children: z.array(rowNodeSchema).min(1),
});
export type SectionNode = z.infer<typeof sectionNodeSchema>;

// Unión genérica de "cualquier nodo del árbol", usada por operaciones que
// recorren la Composition buscando un id sin importar en qué nivel esté
// (Fase 3, Agent Access Layer) — no se usa para construir el árbol (para eso
// se usa cada schema específico según el nivel), solo para direccionar.
export const compositionNodeSchema = z.union([sectionNodeSchema, rowNodeSchema, innerRowNodeSchema, elementNodeSchema]);
export type CompositionNode = z.infer<typeof compositionNodeSchema>;

export const compositionRootSchema = z.array(sectionNodeSchema).min(1);

export const compositionContentSchema = z.object({
  version: z.literal("composition-1"),
  root: compositionRootSchema,
});
export type CompositionContent = z.infer<typeof compositionContentSchema>;
