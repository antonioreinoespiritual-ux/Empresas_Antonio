import type { LandingBlock } from "@repo/core/domain";

export type HeroBlockContent = Extract<LandingBlock, { type: "hero" }>;
export type VslBlockContent = Extract<LandingBlock, { type: "vsl" }>;
export type BenefitsBlockContent = Extract<LandingBlock, { type: "benefits" }>;
export type TestimonialsBlockContent = Extract<LandingBlock, { type: "testimonials" }>;
export type FaqBlockContent = Extract<LandingBlock, { type: "faq" }>;
export type GuaranteeBlockContent = Extract<LandingBlock, { type: "guarantee" }>;
export type CtaBlockContent = Extract<LandingBlock, { type: "cta" }>;
export type RichTextBlockContent = Extract<LandingBlock, { type: "richText" }>;
