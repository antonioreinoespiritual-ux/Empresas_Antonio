import type { HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  tone: "success" | "warning" | "danger" | "neutral";
}

const TONE_CLASSES: Record<StatusPillProps["tone"], string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-surface-sunken text-ink-faint",
};

const DOT_CLASSES: Record<StatusPillProps["tone"], string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-ink-faint",
};

/**
 * Único lenguaje de estado del admin: color + forma, nunca texto plano.
 * El tono es semántico (éxito/pendiente/alerta/neutral) y está separado del
 * acento de marca — el acento solo significa "acción", nunca "estado".
 */
export function StatusPill({ tone, className, children, ...props }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASSES[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}
