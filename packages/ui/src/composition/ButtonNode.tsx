import type { Theme } from "../themes/types";
import { Button } from "../primitives";
import { ResponsiveStyleTag, stylePropsToBaseCss } from "./style-runtime";
import type { ButtonNodeContent } from "./types";

export function ButtonNode({ content, theme }: { content: ButtonNodeContent; theme: Theme }) {
  return (
    <div data-node-id={content.id} style={stylePropsToBaseCss(content.style)}>
      <ResponsiveStyleTag nodeId={content.id} style={content.style} />
      <Button href={content.content.href} variant="primary" buttonPreset={theme.buttonPreset}>
        {content.content.label}
      </Button>
    </div>
  );
}
