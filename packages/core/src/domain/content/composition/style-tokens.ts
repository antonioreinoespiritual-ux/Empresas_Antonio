import { z } from "zod";

// Tokens cerrados para Composition (ARCH-LANDING-EDITOR-02 §5) — nunca CSS
// libre. themeColorTokenSchema duplica a mano las claves de
// `packages/ui/src/themes/types.ts#ThemeColors`, igual que ya hace
// `theme-id.ts` con `ThemeId`: domain no puede importar `packages/ui` (es un
// paquete de componentes React), así que ambos lados se mantienen en
// sincronía manualmente, no por import compartido.
export const THEME_COLOR_TOKENS = [
  "background",
  "surface",
  "surfaceMuted",
  "foreground",
  "foregroundMuted",
  "primary",
  "primaryForeground",
  "secondary",
  "secondaryForeground",
  "accent",
  "accentForeground",
  "destructive",
  "destructiveForeground",
  "success",
  "successForeground",
  "warning",
  "warningForeground",
  "border",
  "focusRing",
] as const;
export const themeColorTokenSchema = z.enum(THEME_COLOR_TOKENS);
export type ThemeColorToken = z.infer<typeof themeColorTokenSchema>;

export const spacingTokenSchema = z.enum(["none", "xs", "sm", "md", "lg", "xl", "2xl"]);
export type SpacingToken = z.infer<typeof spacingTokenSchema>;

export const typeScaleTokenSchema = z.enum(["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"]);
export type TypeScaleToken = z.infer<typeof typeScaleTokenSchema>;

export const weightTokenSchema = z.enum(["normal", "medium", "semibold", "bold"]);
export type WeightToken = z.infer<typeof weightTokenSchema>;

export const alignTokenSchema = z.enum(["start", "center", "end"]);
export type AlignToken = z.infer<typeof alignTokenSchema>;

export const widthScaleTokenSchema = z.enum(["auto", "sm", "md", "lg", "full"]);
export type WidthScaleToken = z.infer<typeof widthScaleTokenSchema>;

export const heightScaleTokenSchema = z.enum(["auto", "sm", "md", "lg", "full"]);
export type HeightScaleToken = z.infer<typeof heightScaleTokenSchema>;

export const overlayTokenSchema = z.enum(["none", "light", "medium", "dark"]);
export type OverlayToken = z.infer<typeof overlayTokenSchema>;

// 1-12, igual que cualquier grid de 12 columnas — solo tiene efecto en un
// nodo que sea hijo directo de un "row" (ARCH-LANDING-EDITOR-02 §8); no hay
// un tipo de nodo "column" separado, es una propiedad de estilo del hijo.
export const columnSpanSchema = z.number().int().min(1).max(12);
export type ColumnSpan = z.infer<typeof columnSpanSchema>;

// Sin `responsive` anidado: el override por breakpoint es un subconjunto de
// un único nivel de estos mismos campos, nunca "responsive dentro de
// responsive" — mantiene el schema cerrado y finito sin necesitar z.lazy.
const styleFieldsSchema = z.object({
  spacing: z
    .object({
      top: spacingTokenSchema.optional(),
      bottom: spacingTokenSchema.optional(),
      x: spacingTokenSchema.optional(),
    })
    .optional(),
  background: z
    .object({
      colorToken: themeColorTokenSchema.optional(),
      imageAssetId: z.string().min(1).optional(),
      overlay: overlayTokenSchema.optional(),
    })
    .optional(),
  typography: z
    .object({
      sizeToken: typeScaleTokenSchema.optional(),
      weightToken: weightTokenSchema.optional(),
      alignToken: alignTokenSchema.optional(),
    })
    .optional(),
  color: z.object({ textToken: themeColorTokenSchema.optional() }).optional(),
  layout: z
    .object({
      widthToken: widthScaleTokenSchema.optional(),
      heightToken: heightScaleTokenSchema.optional(),
      columnSpan: columnSpanSchema.optional(),
    })
    .optional(),
});

export const stylePropsSchema = styleFieldsSchema.extend({
  responsive: z.object({ md: styleFieldsSchema.optional(), lg: styleFieldsSchema.optional() }).optional(),
});
export type StyleProps = z.infer<typeof stylePropsSchema>;
