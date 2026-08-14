import type { SectionNode as SectionNodeContent } from "@repo/core/domain";
import type { Theme } from "../themes/types";
import { Container, Section } from "../primitives";
import { ResponsiveStyleTag, stylePropsToBaseCss } from "./style-runtime";
import { RowNode } from "./RowNode";

export function SectionNode({ node, theme, checkoutHref }: { node: SectionNodeContent; theme: Theme; checkoutHref: string }) {
  return (
    <Section tone="base" data-node-id={node.id} style={stylePropsToBaseCss(node.style)}>
      <ResponsiveStyleTag nodeId={node.id} style={node.style} />
      <Container width="wide" className="flex flex-col gap-6">
        {node.children.map((row) => (
          <RowNode key={row.id} node={row} theme={theme} checkoutHref={checkoutHref} />
        ))}
      </Container>
    </Section>
  );
}
