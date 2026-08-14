import { Grid } from "../primitives";
import { ResponsiveStyleTag, stylePropsToBaseCss } from "./style-runtime";
import type { GalleryNodeContent } from "./types";

// Mismo placeholder honesto que ImageNode hasta Fase 5 (subsistema de medios).
export function GalleryNode({ content }: { content: GalleryNodeContent }) {
  return (
    <div data-node-id={content.id} style={stylePropsToBaseCss(content.style)}>
      <ResponsiveStyleTag nodeId={content.id} style={content.style} />
      <Grid columns={3} gap="sm">
        {content.content.items.map((item, index) => (
          <div
            // eslint-disable-next-line react/no-array-index-key -- los items de una gallery no tienen id propio.
            key={index}
            role="img"
            aria-label={item.altText}
            className="flex aspect-square w-full items-center justify-center rounded-base bg-surface-muted text-xs text-foreground-muted"
          >
            {item.altText}
          </div>
        ))}
      </Grid>
    </div>
  );
}
