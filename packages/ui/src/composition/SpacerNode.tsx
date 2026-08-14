import { ResponsiveStyleTag, stylePropsToBaseCss } from "./style-runtime";
import type { SpacerNodeContent } from "./types";

// El alto lo da `style.spacing` (padding-top/bottom sobre una caja vacía),
// nunca un número libre — ver comentario del schema en composition/node.ts.
export function SpacerNode({ content }: { content: SpacerNodeContent }) {
  return (
    <div data-node-id={content.id} aria-hidden="true" style={stylePropsToBaseCss(content.style)}>
      <ResponsiveStyleTag nodeId={content.id} style={content.style} />
    </div>
  );
}
