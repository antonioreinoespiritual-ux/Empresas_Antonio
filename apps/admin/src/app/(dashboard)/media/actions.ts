"use server";

import { revalidatePath } from "next/cache";
import { createMediaUploadUrl, registerAsset } from "@repo/core/application";
import type { Asset, AssetKind } from "@repo/core/domain";
import { getMediaStorage, media } from "@/lib/media";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function createUploadUrlAction(
  kind: AssetKind,
  contentType: string
): Promise<{ ok: boolean; error?: string; uploadUrl?: string; path?: string }> {
  await requireAdminSession();
  const result = await createMediaUploadUrl({ media: getMediaStorage() }, { kind, contentType });
  if (!result.ok) return { ok: false, error: "Tipo de archivo no soportado" };
  return { ok: true, uploadUrl: result.uploadUrl, path: result.path };
}

// Fase 6a del editor de landings v2 — usada por el selector de Assets del
// editor de Composition (image/video/gallery). Sin paginación: alcanza para
// el tamaño actual de la biblioteca; si crece, es un cambio localizado acá.
export async function listAssetsAction(): Promise<{ assets: Asset[] }> {
  await requireAdminSession();
  const { items } = await media.assets.list({ limit: 100 });
  return { assets: items };
}

export async function registerAssetAction(input: {
  kind: AssetKind;
  path: string;
  altText: string;
  width?: number;
  height?: number;
}): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSession();
  try {
    await registerAsset(
      { assets: media.assets, media: getMediaStorage() },
      { kind: input.kind, path: input.path, altText: input.altText, width: input.width ?? null, height: input.height ?? null }
    );
    revalidatePath("/media");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo registrar el archivo" };
  }
}
