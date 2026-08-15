import type { ElementNode } from "@repo/core/domain";
import type { Theme } from "../themes/types";
import { ButtonNode } from "./ButtonNode";
import { DividerNode } from "./DividerNode";
import { GalleryNode } from "./GalleryNode";
import { IconNode } from "./IconNode";
import { ImageNode } from "./ImageNode";
import { LegacyBlockNode } from "./LegacyBlockNode";
import { RichTextNode } from "./RichTextNode";
import { ShapeNode } from "./ShapeNode";
import { SpacerNode } from "./SpacerNode";
import type { AssetMap } from "./types";
import { VideoNode } from "./VideoNode";

/** Un único nodo elemento (hoja) -> JSX. Reusado tanto por RowNode como por InnerRowNode. */
export function ElementDispatch({
  node,
  theme,
  checkoutHref,
  assets,
}: {
  node: ElementNode;
  theme: Theme;
  checkoutHref: string;
  assets: AssetMap;
}) {
  switch (node.type) {
    case "richText":
      return <RichTextNode content={node} />;
    case "image":
      return <ImageNode content={node} assets={assets} />;
    case "video":
      return <VideoNode content={node} assets={assets} />;
    case "gallery":
      return <GalleryNode content={node} assets={assets} />;
    case "icon":
      return <IconNode content={node} />;
    case "divider":
      return <DividerNode content={node} />;
    case "button":
      return <ButtonNode content={node} theme={theme} />;
    case "spacer":
      return <SpacerNode content={node} />;
    case "shape":
      return <ShapeNode content={node} />;
    case "legacyBlock":
      return <LegacyBlockNode content={node} theme={theme} checkoutHref={checkoutHref} />;
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}
