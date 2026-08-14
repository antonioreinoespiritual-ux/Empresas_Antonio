import type { LandingBlock } from "@repo/core/domain";
import { ThemeProvider } from "../primitives";
import type { Theme, BrandOverride } from "../themes/types";
import { HeroBlock } from "./HeroBlock";
import { VslBlock } from "./VslBlock";
import { BenefitsBlock } from "./BenefitsBlock";
import { TestimonialsBlock } from "./TestimonialsBlock";
import { GuaranteeBlock } from "./GuaranteeBlock";
import { FaqBlock } from "./FaqBlock";
import { CtaBlock } from "./CtaBlock";
import { RichTextBlock } from "./RichTextBlock";

export interface LandingRendererProps {
  blocks: LandingBlock[];
  theme: Theme;
  brand?: BrandOverride;
  /** A dónde apuntan los botones de Hero/CTA — el bloque solo define el copy, nunca la URL. */
  checkoutHref: string;
}

/**
 * Un único LandingBlock -> JSX, sin envolver en ThemeProvider — extraído de
 * LandingRenderer para que el nodo `legacyBlock` de Composition
 * (ARCH-LANDING-EDITOR-02 §11, packages/ui/src/composition/LegacyBlockNode.tsx)
 * reuse exactamente este mismo dispatch en vez de duplicar el switch.
 */
export function LandingBlockDispatch({ block, theme, checkoutHref }: { block: LandingBlock; theme: Theme; checkoutHref: string }) {
  switch (block.type) {
    case "hero":
      return <HeroBlock content={block} checkoutHref={checkoutHref} theme={theme} />;
    case "vsl":
      return <VslBlock content={block} />;
    case "benefits":
      return <BenefitsBlock content={block} theme={theme} />;
    case "testimonials":
      return <TestimonialsBlock content={block} theme={theme} />;
    case "guarantee":
      return <GuaranteeBlock content={block} />;
    case "faq":
      return <FaqBlock content={block} />;
    case "cta":
      return <CtaBlock content={block} checkoutHref={checkoutHref} />;
    case "richText":
      return <RichTextBlock content={block} />;
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

/**
 * Proyección pura (blocks, theme) → JSX. La misma función sirve para
 * apps/web (render real) y, más adelante, para un preview en apps/admin —
 * no tiene efectos secundarios ni depende de nada más que sus props.
 */
export function LandingRenderer({ blocks, theme, brand, checkoutHref }: LandingRendererProps) {
  return (
    <ThemeProvider theme={theme} brand={brand}>
      {blocks.map((block) => (
        <LandingBlockDispatch key={block.id} block={block} theme={theme} checkoutHref={checkoutHref} />
      ))}
    </ThemeProvider>
  );
}
