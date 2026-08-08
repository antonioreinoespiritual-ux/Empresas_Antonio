export type ThemeId = "premium-light" | "premium-dark" | "editorial" | "high-conversion";

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  foreground: string;
  foregroundMuted: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  border: string;
  focusRing: string;
}

export type FontPreset = "sans" | "serif-display" | "editorial-serif";
export type RadiusPreset = "sharp" | "soft" | "round";
export type ButtonPreset = "solid" | "outline-accent" | "pill";
export type CardPreset = "flat-border" | "soft-shadow" | "editorial-divider";
export type SectionSpacingPreset = "compact" | "comfortable" | "spacious";

/**
 * Todo lo que un admin puede elegir para una Offer sin escribir una sola
 * línea de CSS: un id de preset cerrado +, como máximo, un par de colores de
 * marca (ver BrandOverride). Nunca se persiste ni se acepta CSS/HTML libre.
 */
export interface Theme {
  id: ThemeId;
  name: string;
  colors: ThemeColors;
  fontPreset: FontPreset;
  radiusPreset: RadiusPreset;
  buttonPreset: ButtonPreset;
  cardPreset: CardPreset;
  sectionSpacingPreset: SectionSpacingPreset;
}

/** El único "escape hatch" de branding permitido: reemplaza primary/accent sin tocar nada más del preset. */
export interface BrandOverride {
  primaryColor?: string;
  accentColor?: string;
}
