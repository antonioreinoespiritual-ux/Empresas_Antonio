import type { AssetKind } from "./media-asset.entity";

// Lista cerrada de content-type -> extensión por AssetKind (Fase 5, §7).
// Nunca se deriva la extensión del nombre de archivo que mande el cliente
// (no confiable) ni se acepta un content-type fuera de esta lista — mismo
// espíritu de "unión cerrada, nunca input libre" que ya usa StyleProps.
const ALLOWED_CONTENT_TYPES: Record<AssetKind, Record<string, string>> = {
  IMAGE: {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  },
  VIDEO: {
    "video/mp4": "mp4",
    "video/webm": "webm",
  },
};

/** null = content-type no permitido para ese AssetKind. */
export function extensionForContentType(kind: AssetKind, contentType: string): string | null {
  return ALLOWED_CONTENT_TYPES[kind][contentType] ?? null;
}
