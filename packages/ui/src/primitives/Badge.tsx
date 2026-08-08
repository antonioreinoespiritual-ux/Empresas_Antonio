import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "success" | "warning" | "accent";
}

// Colores sólidos, no con modificador de opacidad (bg-success/10): las CSS
// custom properties del theme guardan un hex completo, no canales rgb
// separados, así que la sintaxis de opacidad de Tailwind generaría
// `rgb(#hex / alpha)` — CSS inválido que el navegador descarta en silencio.
const TONE_CLASSES = {
  neutral: "bg-surface-muted text-foreground-muted",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  accent: "bg-accent text-accent-foreground",
};

/** Estado corto (garantía, "pago aprobado", "nuevo") — nunca texto suelto con color inline. */
export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", TONE_CLASSES[tone], className)}
      {...props}
    />
  );
}
