import type { CSSProperties } from "react";
import type { StyleProps } from "@repo/core/domain";

// Traduce StyleProps (tokens cerrados, ARCH-LANDING-EDITOR-02 §5) a CSS real.
// Deliberadamente NUNCA clases de Tailwind construidas dinámicamente
// (`text-${token}`): el contenido de Composition vive en Postgres, no en el
// código fuente, así que el compilador de Tailwind no puede detectar esas
// clases y las purgaría del bundle de producción — mismo motivo por el que
// HeroBlock ya usa `style` inline para backgroundImageUrl. Los tokens de
// color se resuelven a `var(--color-*)`, las mismas custom properties que
// ThemeProvider ya escribe — cero color hardcodeado, cero clase dinámica.

const SPACING_PX: Record<string, string> = {
  none: "0px",
  xs: "8px",
  sm: "16px",
  md: "24px",
  lg: "40px",
  xl: "64px",
  "2xl": "96px",
};

export const TYPE_SCALE_PX: Record<string, string> = {
  xs: "12px",
  sm: "14px",
  md: "16px",
  lg: "20px",
  xl: "24px",
  "2xl": "30px",
  "3xl": "36px",
  "4xl": "48px",
};

const WEIGHT_CSS: Record<string, CSSProperties["fontWeight"]> = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

const WIDTH_CSS: Record<string, string> = { auto: "auto", sm: "320px", md: "480px", lg: "640px", full: "100%" };
const HEIGHT_CSS: Record<string, string> = { auto: "auto", sm: "120px", md: "240px", lg: "480px", full: "100%" };

// Alfa del overlay oscuro sobre un fondo con imagen — mismo criterio que el
// rgba(0,0,0,0.55) fijo que ya usa HeroBlock hoy, ahora parametrizado por token.
export const OVERLAY_ALPHA: Record<string, number> = { none: 0, light: 0.25, medium: 0.45, dark: 0.65 };

export function colorVar(token: string | undefined): string | undefined {
  if (!token) return undefined;
  // camelCase -> kebab-case: "surfaceMuted" -> "surface-muted", igual al
  // sufijo que themeToCssVars() ya usa para cada `--color-*`.
  const kebab = token.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  return `var(--color-${kebab})`;
}

type StyleFields = Omit<StyleProps, "responsive">;

/** Convierte un único nivel de StyleFields (sin `responsive`) a CSSProperties. */
export function styleFieldsToCss(fields: StyleFields | undefined): CSSProperties {
  if (!fields) return {};
  const css: CSSProperties = {};

  if (fields.spacing) {
    if (fields.spacing.top) css.paddingTop = SPACING_PX[fields.spacing.top];
    if (fields.spacing.bottom) css.paddingBottom = SPACING_PX[fields.spacing.bottom];
    if (fields.spacing.x) {
      css.paddingLeft = SPACING_PX[fields.spacing.x];
      css.paddingRight = SPACING_PX[fields.spacing.x];
    }
  }
  if (fields.background?.colorToken) css.backgroundColor = colorVar(fields.background.colorToken);
  if (fields.typography?.sizeToken) css.fontSize = TYPE_SCALE_PX[fields.typography.sizeToken];
  if (fields.typography?.weightToken) css.fontWeight = WEIGHT_CSS[fields.typography.weightToken];
  if (fields.typography?.alignToken) css.textAlign = fields.typography.alignToken;
  if (fields.color?.textToken) css.color = colorVar(fields.color.textToken);
  if (fields.layout?.widthToken) css.width = WIDTH_CSS[fields.layout.widthToken];
  if (fields.layout?.heightToken) css.height = HEIGHT_CSS[fields.layout.heightToken];
  // `layout.columnSpan` NO se traduce acá — solo tiene sentido en el
  // wrapper de grid-item que arma RowNode (packages/ui/src/composition/RowNode.tsx),
  // que es quien realmente controla el grid de 12 columnas. Traducirlo acá
  // también duplicaría `gridColumn` en un elemento que no es en sí mismo el
  // hijo directo del grid (su padre, el wrapper de RowNode, sí lo es).

  return css;
}

/** Estilo base (sin overrides responsive) de un StyleProps completo. */
export function stylePropsToBaseCss(style: StyleProps | undefined): CSSProperties {
  return styleFieldsToCss(style);
}

function cssToInlineDeclarations(css: CSSProperties): string {
  return Object.entries(css)
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${value}`)
    .join(";");
}

/**
 * Bloque <style> con los overrides responsive de un nodo, si tiene. Server
 * Component (sin JS de cliente) — es la única forma de expresar media
 * queries data-driven sin duplicar todo el árbol de render por breakpoint.
 * `nodeId` selecciona por `data-node-id`, el mismo atributo que cada
 * renderer de nodo ya escribe para que un futuro editor visual (Fase 6)
 * pueda direccionar el elemento en el DOM.
 */
export function ResponsiveStyleTag({ nodeId, style }: { nodeId: string; style: StyleProps | undefined }) {
  if (!style?.responsive) return null;
  const rules: string[] = [];
  if (style.responsive.md) {
    rules.push(`@media (min-width:768px){[data-node-id="${nodeId}"]{${cssToInlineDeclarations(styleFieldsToCss(style.responsive.md))}}}`);
  }
  if (style.responsive.lg) {
    rules.push(`@media (min-width:1024px){[data-node-id="${nodeId}"]{${cssToInlineDeclarations(styleFieldsToCss(style.responsive.lg))}}}`);
  }
  if (rules.length === 0) return null;
  // eslint-disable-next-line react/no-danger -- CSS generado desde tokens cerrados, nunca de un string de usuario.
  return <style dangerouslySetInnerHTML={{ __html: rules.join("") }} />;
}
