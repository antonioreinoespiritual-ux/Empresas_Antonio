import { ResponsiveStyleTag, stylePropsToBaseCss } from "./style-runtime";
import type { ImageNodeContent } from "./types";

// Sin Fase 5 (subsistema de medios, ARCH-LANDING-EDITOR-02 §7) todavía no
// existe ningún `Asset` real que resolver a partir de `assetId` — este
// placeholder es honesto sobre ese estado en vez de simular una imagen que
// no existe. Mantiene `altText` visible/accesible ya desde ahora, así que
// no hay retrabajo de accesibilidad cuando Fase 5 conecte el storage real.
export function ImageNode({ content }: { content: ImageNodeContent }) {
  return (
    <div
      data-node-id={content.id}
      role="img"
      aria-label={content.content.altText}
      className="flex aspect-video w-full items-center justify-center rounded-base bg-surface-muted text-sm text-foreground-muted"
      style={stylePropsToBaseCss(content.style)}
    >
      <ResponsiveStyleTag nodeId={content.id} style={content.style} />
      {content.content.altText} (asset {content.content.assetId} — pendiente Fase 5)
    </div>
  );
}
