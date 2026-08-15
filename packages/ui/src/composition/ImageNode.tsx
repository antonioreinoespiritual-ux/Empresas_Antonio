import Image from "next/image";
import { ResponsiveStyleTag, stylePropsToBaseCss } from "./style-runtime";
import type { AssetMap, ImageNodeContent } from "./types";

// Placeholder honesto (Fase 5, ARCH-LANDING-EDITOR-02 §7): un `assetId` que
// no resuelve en `assets` — Asset borrado, o el bucket real de Antonio
// todavía no está configurado en este entorno — nunca se simula una imagen
// que no existe. `altText` sigue visible/accesible en ambos casos.
export function ImageNode({ content, assets }: { content: ImageNodeContent; assets: AssetMap }) {
  const asset = assets[content.content.assetId];

  if (!asset) {
    return (
      <div
        data-node-id={content.id}
        role="img"
        aria-label={content.content.altText}
        className="flex aspect-video w-full items-center justify-center rounded-base bg-surface-muted text-sm text-foreground-muted"
        style={stylePropsToBaseCss(content.style)}
      >
        <ResponsiveStyleTag nodeId={content.id} style={content.style} />
        {content.content.altText} (asset {content.content.assetId} no encontrado)
      </div>
    );
  }

  return (
    <div data-node-id={content.id} className="relative w-full" style={stylePropsToBaseCss(content.style)}>
      <ResponsiveStyleTag nodeId={content.id} style={content.style} />
      {asset.width && asset.height ? (
        <Image
          src={asset.url}
          alt={content.content.altText}
          width={asset.width}
          height={asset.height}
          className="h-auto w-full rounded-base object-cover"
        />
      ) : (
        // Sin dimensiones conocidas (Asset registrado sin width/height) —
        // `fill` requiere un contenedor con posición/alto explícitos.
        <div className="relative aspect-video w-full overflow-hidden rounded-base">
          <Image src={asset.url} alt={content.content.altText} fill className="object-cover" />
        </div>
      )}
    </div>
  );
}
