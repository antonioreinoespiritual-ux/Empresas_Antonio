import type { CompositionContent } from "@repo/core/domain";
import { ThemeProvider } from "../primitives";
import type { BrandOverride, Theme } from "../themes/types";
import { SectionNode } from "./SectionNode";

export interface CompositionRendererProps {
  composition: CompositionContent;
  theme: Theme;
  brand?: BrandOverride;
  /** A dónde apuntan los ButtonNode/legacyBlock que lo necesiten — mismo criterio que LandingRenderer. */
  checkoutHref: string;
}

/**
 * Proyección pura (Composition, theme) → JSX — mismo contrato que
 * `LandingRenderer` (ARCH-LANDING-EDITOR-02 Fase 2): sin efectos
 * secundarios, sin resolver nada por fuera de sus props. `root` es siempre
 * una lista de `section` (garantía del propio schema de dominio).
 */
export function CompositionRenderer({ composition, theme, brand, checkoutHref }: CompositionRendererProps) {
  return (
    <ThemeProvider theme={theme} brand={brand}>
      {composition.root.map((section) => (
        <SectionNode key={section.id} node={section} theme={theme} checkoutHref={checkoutHref} />
      ))}
    </ThemeProvider>
  );
}
