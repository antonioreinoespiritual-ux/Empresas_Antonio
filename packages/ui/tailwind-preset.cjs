/**
 * Preset de Tailwind compartido: mapea utilidades semánticas (bg-primary,
 * text-foreground, rounded-button...) a las CSS custom properties que
 * themeToCssVars() escribe en runtime. Ningún componente de packages/ui usa
 * un color/spacing/radius arbitrario — todo pasa por estos nombres.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        "surface-muted": "var(--color-surface-muted)",
        foreground: "var(--color-foreground)",
        "foreground-muted": "var(--color-foreground-muted)",
        primary: { DEFAULT: "var(--color-primary)", foreground: "var(--color-primary-foreground)" },
        secondary: { DEFAULT: "var(--color-secondary)", foreground: "var(--color-secondary-foreground)" },
        accent: { DEFAULT: "var(--color-accent)", foreground: "var(--color-accent-foreground)" },
        destructive: { DEFAULT: "var(--color-destructive)", foreground: "var(--color-destructive-foreground)" },
        success: { DEFAULT: "var(--color-success)", foreground: "var(--color-success-foreground)" },
        warning: { DEFAULT: "var(--color-warning)", foreground: "var(--color-warning-foreground)" },
        border: "var(--color-border)",
        "focus-ring": "var(--color-focus-ring)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
      },
      borderRadius: {
        base: "var(--radius-base)",
        button: "var(--radius-button)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      spacing: {
        "section-y": "var(--space-section-y)",
      },
      transitionDuration: {
        fast: "var(--transition-fast)",
        base: "var(--transition-base)",
        slow: "var(--transition-slow)",
      },
      ringColor: {
        DEFAULT: "var(--color-focus-ring)",
      },
    },
  },
  // RichTextBlock usa la clase `prose` para el único bloque que renderiza
  // HTML de admin — sin este plugin, Tailwind no la reconoce y el preflight
  // deja títulos/listas sin ninguna jerarquía visual (hallazgo de revisión).
  plugins: [require("@tailwindcss/typography")],
};
