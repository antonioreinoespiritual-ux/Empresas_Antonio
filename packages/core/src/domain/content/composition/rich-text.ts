import { z } from "zod";
import { themeColorTokenSchema, typeScaleTokenSchema } from "./style-tokens";
import { safeLinkUrlSchema } from "./safe-url";

// Árbol cerrado tipo Portable Text — nunca HTML libre (ARCH-LANDING-EDITOR-02
// §6). La serialización a JSX es una función pura sobre este árbol de datos
// ya validado por Zod: nunca se parsea ni inyecta una cadena HTML, así que
// XSS queda descartado por construcción, no por sanitización posterior. No
// reemplaza al `richText.html` de los bloques legacy (page-content.ts) — esa
// vía sigue existiendo intacta para Pages ya guardadas así.
export const richTextMarkSchema = z.union([
  z.literal("bold"),
  z.literal("italic"),
  z.literal("underline"),
  z.literal("strike"),
  z.literal("highlight"),
  z.object({ type: z.literal("link"), href: safeLinkUrlSchema }),
  z.object({ type: z.literal("colorToken"), token: themeColorTokenSchema }),
  z.object({ type: z.literal("sizeToken"), token: typeScaleTokenSchema }),
]);
export type RichTextMark = z.infer<typeof richTextMarkSchema>;

export const richTextSpanSchema = z.object({
  text: z.string().min(1),
  marks: z.array(richTextMarkSchema).default([]),
});
export type RichTextSpan = z.infer<typeof richTextSpanSchema>;

export const richTextBlockNodeSchema = z.object({
  style: z.enum(["p", "h1", "h2", "h3", "h4"]),
  children: z.array(richTextSpanSchema).min(1),
});
export type RichTextBlockNode = z.infer<typeof richTextBlockNodeSchema>;

export const richTextDocSchema = z.array(richTextBlockNodeSchema).min(1);
export type RichTextDoc = z.infer<typeof richTextDocSchema>;
