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
 * Proyección pura (blocks, theme) → JSX. La misma función sirve para
 * apps/web (render real) y, más adelante, para un preview en apps/admin —
 * no tiene efectos secundarios ni depende de nada más que sus props.
 */
export function LandingRenderer({ blocks, theme, brand, checkoutHref }: LandingRendererProps) {
  return (
    <ThemeProvider theme={theme} brand={brand}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "hero":
            return <HeroBlock key={index} content={block} checkoutHref={checkoutHref} theme={theme} />;
          case "vsl":
            return <VslBlock key={index} content={block} />;
          case "benefits":
            return <BenefitsBlock key={index} content={block} theme={theme} />;
          case "testimonials":
            return <TestimonialsBlock key={index} content={block} theme={theme} />;
          case "guarantee":
            return <GuaranteeBlock key={index} content={block} />;
          case "faq":
            return <FaqBlock key={index} content={block} />;
          case "cta":
            return <CtaBlock key={index} content={block} checkoutHref={checkoutHref} />;
          case "richText":
            return <RichTextBlock key={index} content={block} />;
          default: {
            const exhaustive: never = block;
            return exhaustive;
          }
        }
      })}
    </ThemeProvider>
  );
}
