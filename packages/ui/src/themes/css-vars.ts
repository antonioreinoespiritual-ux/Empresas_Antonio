import type { BrandOverride, Theme } from "./types";

const FONT_SANS = 'ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const FONT_SERIF = 'Georgia, "Iowan Old Style", "Palatino Linotype", serif';

const RADIUS_BASE_BY_PRESET: Record<Theme["radiusPreset"], string> = {
  sharp: "2px",
  soft: "10px",
  round: "16px",
};

const SHADOW_CARD_BY_PRESET: Record<Theme["cardPreset"], string> = {
  "flat-border": "none",
  "soft-shadow": "0 8px 24px rgba(15, 15, 12, 0.08)",
  "editorial-divider": "none",
};

const SPACE_SECTION_BY_PRESET: Record<Theme["sectionSpacingPreset"], string> = {
  compact: "48px",
  comfortable: "80px",
  spacious: "112px",
};

/**
 * Único punto donde un Theme se convierte en CSS real. Todo lo que pinta la
 * página vive en estas custom properties — nunca en un color/():spacing
 * suelto dentro de un componente. `overrides` es el único hueco de
 * "branding permitido": reemplaza primary/accent sin abrir CSS libre.
 */
export function themeToCssVars(theme: Theme, overrides?: BrandOverride): Record<string, string> {
  const primary = overrides?.primaryColor ?? theme.colors.primary;
  const accent = overrides?.accentColor ?? theme.colors.accent;

  return {
    "--color-background": theme.colors.background,
    "--color-surface": theme.colors.surface,
    "--color-surface-muted": theme.colors.surfaceMuted,
    "--color-foreground": theme.colors.foreground,
    "--color-foreground-muted": theme.colors.foregroundMuted,
    "--color-primary": primary,
    "--color-primary-foreground": theme.colors.primaryForeground,
    "--color-secondary": theme.colors.secondary,
    "--color-secondary-foreground": theme.colors.secondaryForeground,
    "--color-accent": accent,
    "--color-accent-foreground": theme.colors.accentForeground,
    "--color-destructive": theme.colors.destructive,
    "--color-destructive-foreground": theme.colors.destructiveForeground,
    "--color-success": theme.colors.success,
    "--color-success-foreground": theme.colors.successForeground,
    "--color-warning": theme.colors.warning,
    "--color-warning-foreground": theme.colors.warningForeground,
    "--color-border": theme.colors.border,
    "--color-focus-ring": theme.colors.focusRing,

    "--font-sans": FONT_SANS,
    "--font-display": theme.fontPreset === "sans" ? FONT_SANS : FONT_SERIF,

    "--radius-sm": "4px",
    "--radius-md": "8px",
    "--radius-lg": "14px",
    "--radius-xl": "20px",
    "--radius-full": "999px",
    "--radius-base": RADIUS_BASE_BY_PRESET[theme.radiusPreset],
    "--radius-button": theme.buttonPreset === "pill" ? "999px" : RADIUS_BASE_BY_PRESET[theme.radiusPreset],

    "--shadow-sm": "0 1px 2px rgba(15, 15, 12, 0.04)",
    "--shadow-md": "0 8px 24px rgba(15, 15, 12, 0.08)",
    "--shadow-lg": "0 16px 48px rgba(15, 15, 12, 0.12)",
    "--shadow-card": SHADOW_CARD_BY_PRESET[theme.cardPreset],

    "--space-section-y": SPACE_SECTION_BY_PRESET[theme.sectionSpacingPreset],

    "--transition-fast": "150ms",
    "--transition-base": "200ms",
    "--transition-slow": "300ms",
    "--ease-standard": "cubic-bezier(0.4, 0, 0.2, 1)",
  };
}
