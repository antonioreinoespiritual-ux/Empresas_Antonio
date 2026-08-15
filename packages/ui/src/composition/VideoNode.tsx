import { VideoFrame } from "../primitives";
import { ResponsiveStyleTag, stylePropsToBaseCss } from "./style-runtime";
import type { AssetMap, VideoNodeContent } from "./types";

export function VideoNode({ content, assets }: { content: VideoNodeContent; assets: AssetMap }) {
  const { source, autoplay } = content.content;

  if (source.kind === "embed") {
    return (
      <div data-node-id={content.id} style={stylePropsToBaseCss(content.style)}>
        <ResponsiveStyleTag nodeId={content.id} style={content.style} />
        <VideoFrame embedUrl={source.embedUrl} autoplay={autoplay} />
      </div>
    );
  }

  // source.kind === "asset" — un `assetId` que no resuelve en `assets` es
  // igual de posible que en ImageNode (mismo placeholder honesto).
  const asset = assets[source.assetId];
  if (!asset) {
    return (
      <div
        data-node-id={content.id}
        role="img"
        aria-label="Video propio"
        className="flex aspect-video w-full items-center justify-center rounded-base bg-surface-muted text-sm text-foreground-muted"
        style={stylePropsToBaseCss(content.style)}
      >
        <ResponsiveStyleTag nodeId={content.id} style={content.style} />
        Video (asset {source.assetId} no encontrado)
      </div>
    );
  }

  const poster = source.posterAssetId ? assets[source.posterAssetId] : undefined;
  return (
    <div data-node-id={content.id} style={stylePropsToBaseCss(content.style)}>
      <ResponsiveStyleTag nodeId={content.id} style={content.style} />
      {/* Autoplay solo con poster + mute (mismo criterio que VideoFrame, §7) — sin poster, controles visibles y sin autoplay. */}
      <video
        src={asset.url}
        poster={poster?.url}
        controls={!(autoplay && poster)}
        autoPlay={autoplay && Boolean(poster)}
        muted={autoplay && Boolean(poster)}
        loop={autoplay && Boolean(poster)}
        playsInline
        className="w-full rounded-base"
      >
        <track kind="captions" />
      </video>
    </div>
  );
}
