import type { HTMLAttributes } from "react";
import type { Theme } from "../themes/types";
import { cn } from "../utils/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  cardPreset?: Theme["cardPreset"];
}

const PRESET_CLASSES: Record<Theme["cardPreset"], string> = {
  "flat-border": "rounded-base border border-border",
  "soft-shadow": "rounded-base shadow-card",
  "editorial-divider": "rounded-none border-t-2 border-foreground",
};

/** Contenedor de contenido agrupado (Benefits item, Testimonial, Guarantee) — nunca un div con shadow suelto. */
export function Card({ cardPreset = "flat-border", className, ...props }: CardProps) {
  return <div className={cn("bg-surface p-6", PRESET_CLASSES[cardPreset], className)} {...props} />;
}
