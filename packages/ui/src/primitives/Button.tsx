import type { ButtonHTMLAttributes } from "react";
import type { Theme } from "../themes/types";
import { cn } from "../utils/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  /** Solo afecta el relleno del variant "primary" (solid vs. contorno) — el radio ya llega por --radius-button. */
  buttonPreset?: Theme["buttonPreset"];
}

const SIZE_CLASSES = { sm: "px-4 py-2 text-sm", md: "px-5 py-2.5 text-[15px]", lg: "px-7 py-3.5 text-base" };

const BASE =
  "inline-flex items-center justify-center gap-2 font-sans font-semibold rounded-button transition-colors duration-base disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2";

function primaryClasses(preset: Theme["buttonPreset"]): string {
  if (preset === "outline-accent") {
    return "bg-transparent text-primary border border-primary hover:bg-primary hover:text-primary-foreground";
  }
  return "bg-primary text-primary-foreground hover:opacity-90";
}

const VARIANT_CLASSES: Record<Exclude<ButtonProps["variant"], undefined>, string> = {
  primary: "", // resuelto dinámicamente por primaryClasses()
  secondary: "bg-secondary text-secondary-foreground hover:opacity-90",
  ghost: "bg-transparent text-foreground hover:bg-surface-muted",
  destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
};

/** Único botón del sistema — cada bloque comercial lo usa en vez de un <button> con clases sueltas. */
export function Button({ variant = "primary", size = "md", buttonPreset = "solid", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(BASE, SIZE_CLASSES[size], variant === "primary" ? primaryClasses(buttonPreset) : VARIANT_CLASSES[variant], className)}
      {...props}
    />
  );
}
