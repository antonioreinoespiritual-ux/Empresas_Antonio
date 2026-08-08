import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  /** "base" = fondo de página; "muted" = pausa visual (Guarantee); "inverted" = cierre de alto contraste (CTA final). */
  tone?: "base" | "muted" | "inverted";
}

const TONE_CLASSES = {
  base: "bg-background text-foreground",
  muted: "bg-surface-muted text-foreground",
  inverted: "bg-foreground text-background",
};

/** Unidad de ritmo vertical de la página — el spacing viene siempre de sectionSpacingPreset vía --space-section-y, nunca de un padding suelto. */
export function Section({ tone = "base", className, ...props }: SectionProps) {
  return <section className={cn("py-section-y", TONE_CLASSES[tone], className)} {...props} />;
}
