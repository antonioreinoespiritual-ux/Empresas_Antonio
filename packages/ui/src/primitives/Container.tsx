import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** "content" = ancho de lectura (hero, texto); "wide" = grids anchos (testimonials, benefits). */
  width?: "content" | "wide";
}

const MAX_WIDTH = { content: "max-w-3xl", wide: "max-w-6xl" };

export function Container({ width = "wide", className, ...props }: ContainerProps) {
  return <div className={cn("mx-auto w-full px-5 sm:px-6 lg:px-8", MAX_WIDTH[width], className)} {...props} />;
}
