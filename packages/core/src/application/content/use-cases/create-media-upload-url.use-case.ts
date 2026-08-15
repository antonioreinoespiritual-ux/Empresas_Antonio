import { randomBytes } from "node:crypto";
import { extensionForContentType, type AssetKind } from "../../../domain";
import type { MediaStorage } from "../ports/media-storage.port";

export interface CreateMediaUploadUrlDeps {
  media: MediaStorage;
}

export interface CreateMediaUploadUrlInput {
  kind: AssetKind;
  contentType: string;
}

export type CreateMediaUploadUrlResult =
  | { ok: true; uploadUrl: string; path: string; expiresAt: Date }
  | { ok: false; reason: "unsupported_content_type" };

/**
 * Genera un path server-side aleatorio (nunca uno que mande el cliente) y
 * pide al storage una URL firmada para ese path — Fase 5, §7. Sin registro
 * en DB todavía: eso pasa en `registerAsset`, después de que el cliente
 * suba el binario directo al storage. No requiere Idempotency-Key (mismo
 * criterio que `createPreviewToken`, F5 del Agent Access Layer): pedir dos
 * URLs firmadas para el mismo intento de subida no es dañino, solo deja un
 * path sin usar en el storage (huérfano aceptable, ver §7 riesgos).
 */
export async function createMediaUploadUrl(
  deps: CreateMediaUploadUrlDeps,
  input: CreateMediaUploadUrlInput
): Promise<CreateMediaUploadUrlResult> {
  const extension = extensionForContentType(input.kind, input.contentType);
  if (!extension) {
    return { ok: false, reason: "unsupported_content_type" };
  }

  const path = `${input.kind.toLowerCase()}/${randomBytes(16).toString("hex")}.${extension}`;
  const { uploadUrl, expiresAt } = await deps.media.createUploadUrl({ path, contentType: input.contentType });

  return { ok: true, uploadUrl, path, expiresAt };
}
