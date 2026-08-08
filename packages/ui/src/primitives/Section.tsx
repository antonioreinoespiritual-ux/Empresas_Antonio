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

// "Full-bleed break-out": el fondo de la sección debe llegar al borde del
// viewport aunque un layout ancestro (p. ej. el max-w-5xl de
// apps/web/(marketing)/layout.tsx) constriña el ancho de la página — sin
// esto, tone="muted"/"inverted" quedan como una franja centrada con
// márgenes blancos en vez de un bloque de contraste real (hallazgo real de
// revisión). <Container>, adentro, sigue acotando el contenido a un ancho
// de lectura — solo el fondo se expande.
const FULL_BLEED = "relative left-1/2 right-1/2 w-screen -translate-x-1/2";

/** Unidad de ritmo vertical de la página — el spacing viene siempre de sectionSpacingPreset vía --space-section-y, nunca de un padding suelto. */
export function Section({ tone = "base", className, ...props }: SectionProps) {
  return <section className={cn("py-section-y", FULL_BLEED, TONE_CLASSES[tone], className)} {...props} />;
}
