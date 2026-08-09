import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md";
  /** Navega en vez de ejecutar una acción — se renderiza como next/link, nunca anidado dentro de otro <a>. */
  href?: string;
}

const SIZE_CLASSES = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-3.5 text-sm" };

const VARIANT_CLASSES: Record<Exclude<ButtonProps["variant"], undefined>, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong",
  secondary: "bg-surface text-ink border border-border hover:bg-surface-sunken",
  ghost: "bg-transparent text-ink-muted hover:bg-surface-sunken hover:text-ink",
  destructive: "bg-danger text-white hover:opacity-90",
};

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors " +
  "disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent focus-visible:ring-offset-1";

/** Único botón del admin — reemplaza los `bg-neutral-900 rounded px-4 py-2` sueltos y los enlaces subrayados usados como acción. */
export function Button({ variant = "primary", size = "md", className, href, ...props }: ButtonProps) {
  const classes = cn(BASE, SIZE_CLASSES[size], VARIANT_CLASSES[variant], className);
  if (href) {
    return <Link href={href} className={classes} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)} />;
  }
  return <button className={classes} {...props} />;
}
