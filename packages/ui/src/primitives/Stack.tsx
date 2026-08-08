import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: "row" | "column";
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  wrap?: boolean;
}

const GAP_CLASSES = { xs: "gap-2", sm: "gap-3", md: "gap-5", lg: "gap-8", xl: "gap-12" };
const ALIGN_CLASSES = { start: "items-start", center: "items-center", end: "items-end", stretch: "items-stretch" };
const JUSTIFY_CLASSES = { start: "justify-start", center: "justify-center", end: "justify-end", between: "justify-between" };

/** Reemplaza los `flex flex-col gap-4` repetidos por todo el código admin/web hoy. */
export function Stack({
  direction = "column",
  gap = "md",
  align = "stretch",
  justify = "start",
  wrap = false,
  className,
  ...props
}: StackProps) {
  return (
    <div
      className={cn(
        "flex",
        direction === "row" ? "flex-row" : "flex-col",
        GAP_CLASSES[gap],
        ALIGN_CLASSES[align],
        JUSTIFY_CLASSES[justify],
        wrap && "flex-wrap",
        className
      )}
      {...props}
    />
  );
}
