import Image from "next/image";
import { Grid } from "../primitives";
import { ResponsiveStyleTag, stylePropsToBaseCss } from "./style-runtime";
import type { AssetMap, GalleryNodeContent } from "./types";

// Placeholder honesto (Fase 5, §7) por item cuyo assetId no resuelve en `assets`.
export function GalleryNode({ content, assets }: { content: GalleryNodeContent; assets: AssetMap }) {
  return (
    <div data-node-id={content.id} style={stylePropsToBaseCss(content.style)}>
      <ResponsiveStyleTag nodeId={content.id} style={content.style} />
      <Grid columns={3} gap="sm">
        {content.content.items.map((item, index) => {
          const asset = assets[item.assetId];
          return (
            // eslint-disable-next-line react/no-array-index-key -- los items de una gallery no tienen id propio.
            <div key={index} className="relative aspect-square w-full overflow-hidden rounded-base bg-surface-muted">
              {asset ? (
                <Image src={asset.url} alt={item.altText} fill className="object-cover" />
              ) : (
                <div role="img" aria-label={item.altText} className="flex h-full w-full items-center justify-center text-xs text-foreground-muted">
                  {item.altText}
                </div>
              )}
            </div>
          );
        })}
      </Grid>
    </div>
  );
}
