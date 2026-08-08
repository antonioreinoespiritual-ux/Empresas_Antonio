import type { CSSProperties, ReactNode } from "react";
import { themeToCssVars } from "../themes/css-vars";
import type { BrandOverride, Theme } from "../themes/types";

export interface ThemeProviderProps {
  theme: Theme;
  brand?: BrandOverride;
  children: ReactNode;
  className?: string;
}

/**
 * Único puente entre un Theme y el DOM: escribe sus custom properties en un
 * `style` inline sobre un `div`. Sin JS de cliente — es un Server Component
 * puro, así que puede envolver landing, checkout y thank-you sin costo de
 * hidratación. Los descendientes heredan las variables por cascada normal de
 * CSS; ningún componente necesita conocer el Theme directamente.
 */
export function ThemeProvider({ theme, brand, children, className }: ThemeProviderProps) {
  const vars = themeToCssVars(theme, brand);
  return (
    <div data-theme={theme.id} className={className} style={vars as CSSProperties}>
      {children}
    </div>
  );
}
