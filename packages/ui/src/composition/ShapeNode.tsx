import { colorVar, ResponsiveStyleTag, stylePropsToBaseCss } from "./style-runtime";
import type { ShapeNodeContent } from "./types";

const VARIANT_CLASS: Record<ShapeNodeContent["content"]["variant"], string> = {
  dot: "h-3 w-3 rounded-full",
  line: "h-1 w-16 rounded-full",
  blob: "h-24 w-24 rounded-[40%_60%_60%_40%/60%_40%_60%_40%]",
};

/** Puramente decorativo — nunca transmite información por sí solo. */
export function ShapeNode({ content }: { content: ShapeNodeContent }) {
  const colorToken = content.style?.background?.colorToken ?? content.style?.color?.textToken;
  return (
    <div
      data-node-id={content.id}
      aria-hidden="true"
      className={VARIANT_CLASS[content.content.variant]}
      style={{ ...stylePropsToBaseCss(content.style), backgroundColor: colorVar(colorToken) ?? "var(--color-accent)" }}
    >
      <ResponsiveStyleTag nodeId={content.id} style={content.style} />
    </div>
  );
}
