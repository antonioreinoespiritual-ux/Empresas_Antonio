import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface TextProps extends HTMLAttributes<HTMLParagraphElement> {
  as?: "p" | "span";
  size?: "sm" | "md" | "lg";
  tone?: "default" | "muted";
  weight?: "normal" | "medium" | "semibold";
}

const SIZE_CLASSES = { sm: "text-sm", md: "text-base", lg: "text-lg" };
// "default" no fija color: hereda el `text-foreground`/`text-background` que
// ya puso <Section> según su tone. Si fijara text-foreground acá, un <Text>
// dentro de <Section tone="inverted"> (bg-foreground text-background)
// quedaría con texto foreground sobre fondo foreground — invisible.
const TONE_CLASSES = { default: "", muted: "text-foreground-muted" };
const WEIGHT_CLASSES = { normal: "font-normal", medium: "font-medium", semibold: "font-semibold" };

/** Cuerpo de texto — ancho de lectura y color siempre desde tokens, nunca gris hardcodeado. */
export function Text({ as = "p", size = "md", tone = "default", weight = "normal", className, ...props }: TextProps) {
  const Tag = as;
  return (
    <Tag
      className={cn("font-sans max-w-[65ch] leading-relaxed", SIZE_CLASSES[size], TONE_CLASSES[tone], WEIGHT_CLASSES[weight], className)}
      {...props}
    />
  );
}
