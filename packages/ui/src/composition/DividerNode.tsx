import { Divider } from "../primitives";
import { ResponsiveStyleTag, stylePropsToBaseCss } from "./style-runtime";
import type { DividerNodeContent } from "./types";

export function DividerNode({ content }: { content: DividerNodeContent }) {
  return (
    <div data-node-id={content.id} aria-hidden="true" style={stylePropsToBaseCss(content.style)}>
      <ResponsiveStyleTag nodeId={content.id} style={content.style} />
      <Divider />
    </div>
  );
}
