"use server";

import { revalidatePath } from "next/cache";
import { createMediaUploadUrl, registerAsset } from "@repo/core/application";
import type { AssetKind } from "@repo/core/domain";
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
