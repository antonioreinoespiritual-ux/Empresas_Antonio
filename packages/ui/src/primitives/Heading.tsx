import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Nivel semántico real del documento (accesibilidad) — independiente del tamaño visual. */
  as?: "h1" | "h2" | "h3" | "h4";
  /** Tamaño visual — casi siempre igual a `as`, pero permite un h2 con tamaño de h1 en un CTA de cierre. */
  size?: "h1" | "h2" | "h3" | "h4";
}

const SIZE_CLASSES = {
  h1: "text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] tracking-tight",
  h2: "text-3xl sm:text-4xl font-semibold leading-tight tracking-tight",
  h3: "text-2xl sm:text-2xl font-semibold leading-snug",
  h4: "text-lg font-semibold leading-snug",
};

/** Toda jerarquía de titulares del sistema pasa por acá — font-display (serif o sans según Theme) + balance de línea. */
export function Heading({ as = "h2", size, className, ...props }: HeadingProps) {
  const Tag = as;
  return <Tag className={cn("font-display text-balance", SIZE_CLASSES[size ?? as], className)} {...props} />;
}
