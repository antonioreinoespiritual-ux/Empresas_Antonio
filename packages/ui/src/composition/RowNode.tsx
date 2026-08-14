import type { ElementNode, InnerRowNode, RowNode as RowNodeContent } from "@repo/core/domain";
import type { Theme } from "../themes/types";
import { ElementDispatch } from "./ElementDispatch";
import { ResponsiveStyleTag, stylePropsToBaseCss } from "./style-runtime";

// Cada hijo directo de una row es, conceptualmente, una columna de un grid
// de 12 (ARCH-LANDING-EDITOR-02 §8) — sin columnSpan explícito, ocupa el
// ancho completo (span 12), o sea se apila como un bloque normal. Solo
// `legacyBlock` no tiene `style` en absoluto (gestiona su propia
// apariencia), así que siempre es span 12.
function columnSpanOf(node: ElementNode | InnerRowNode): number {
  if (node.type === "legacyBlock") return 12;
  return node.style?.layout?.columnSpan ?? 12;
}

interface RowNodeProps {
  node: RowNodeContent | InnerRowNode;
  theme: Theme;
  checkoutHref: string;
}

/**
 * Renderiza una row y, recursivamente, como máximo una row anidada dentro de
 * un hijo (InnerRowNode) — la recursión termina sola porque el propio schema
 * de dominio no permite una 3ª row (profundidad máxima, P-1). No hace falta
 * un contador de profundidad separado acá.
 */
export function RowNode({ node, theme, checkoutHref }: RowNodeProps) {
  return (
    <div className="grid grid-cols-12 gap-6" data-node-id={node.id} style={stylePropsToBaseCss(node.style)}>
      <ResponsiveStyleTag nodeId={node.id} style={node.style} />
      {node.children.map((child) => {
        const span = columnSpanOf(child);
        return (
          <div key={child.id} style={{ gridColumn: `span ${span} / span ${span}` }}>
            {child.type === "row" ? (
              <RowNode node={child} theme={theme} checkoutHref={checkoutHref} />
            ) : (
              <ElementDispatch node={child} theme={theme} checkoutHref={checkoutHref} />
            )}
          </div>
        );
      })}
    </div>
  );
}
