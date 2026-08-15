import type { Asset, AssetKind } from "../../../domain";
import type { AssetRepository } from "../ports/asset-repository.port";
import type { MediaStorage } from "../ports/media-storage.port";

export interface RegisterAssetDeps {
  assets: AssetRepository;
  media: MediaStorage;
}

export interface RegisterAssetInput {
  kind: AssetKind;
  /** El `path` devuelto por createMediaUploadUrl — nunca una URL suelta que mande el cliente (§20). */
  path: string;
  width: number | null;
  height: number | null;
  altText: string;
}

/**
 * Registra el Asset una vez que el cliente ya subió el binario al storage
 * (Fase 5, §7). `url` la computa el servidor a partir de `path` vía
 * `MediaStorage.publicUrlFor` — nunca un valor que el cliente pueda pasar
 * directamente, así un `POST /media/assets` nunca puede registrar una URL
 * que apunte fuera del storage propio.
 */
export async function registerAsset(deps: RegisterAssetDeps, input: RegisterAssetInput): Promise<Asset> {
  const url = deps.media.publicUrlFor(input.path);
  return deps.assets.create({
    kind: input.kind,
    url,
    width: input.width,
    height: input.height,
    altText: input.altText,
    provider: "supabase-storage",
  });
}
