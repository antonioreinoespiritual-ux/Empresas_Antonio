import { VideoFrame } from "../primitives";
import { ResponsiveStyleTag, stylePropsToBaseCss } from "./style-runtime";
import type { VideoNodeContent } from "./types";

export function VideoNode({ content }: { content: VideoNodeContent }) {
  const { source, autoplay } = content.content;

  if (source.kind === "embed") {
    return (
      <div data-node-id={content.id} style={stylePropsToBaseCss(content.style)}>
        <ResponsiveStyleTag nodeId={content.id} style={content.style} />
        <VideoFrame embedUrl={source.embedUrl} autoplay={autoplay} />
      </div>
    );
  }

  // source.kind === "asset": sin Fase 5 todavía no hay un Asset real que
  // resolver — mismo criterio de placeholder honesto que ImageNode.
  return (
    <div
      data-node-id={content.id}
      role="img"
      aria-label="Video propio"
      className="flex aspect-video w-full items-center justify-center rounded-base bg-surface-muted text-sm text-foreground-muted"
      style={stylePropsToBaseCss(content.style)}
    >
      <ResponsiveStyleTag nodeId={content.id} style={content.style} />
      Video (asset {source.assetId} — pendiente Fase 5)
    </div>
  );
}
