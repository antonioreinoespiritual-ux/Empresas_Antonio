import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  /** Columnas en desktop (lg+) — siempre 1 columna en mobile, mobile-first. */
  columns?: 2 | 3 | 4;
  gap?: "sm" | "md" | "lg";
}

const COLUMNS_CLASSES = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-2 xl:grid-cols-4",
};

const GAP_CLASSES = { sm: "gap-4", md: "gap-6", lg: "gap-8" };

/** Grid de bloques comerciales (Benefits, Testimonials): 1 columna en mobile, se expande desde lg. */
export function Grid({ columns = 3, gap = "md", className, ...props }: GridProps) {
  return <div className={cn("grid grid-cols-1", COLUMNS_CLASSES[columns], GAP_CLASSES[gap], className)} {...props} />;
}
