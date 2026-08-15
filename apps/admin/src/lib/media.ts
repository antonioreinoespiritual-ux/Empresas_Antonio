import { PrismaAssetRepository, SupabaseStorageMediaAdapter } from "@repo/core/infrastructure";
import type { MediaStorage } from "@repo/core/application";

// Composition root de apps/admin para el panel /media (Fase 5 del editor de
// landings v2). Mismo criterio que apps/agent-api/src/lib/media-storage.ts:
// el adaptador de storage se instancia perezosamente para no romper el
// resto de la app si las env vars de Supabase Storage todavía no están
// configuradas (p. ej. dev local antes de que Antonio provisione el bucket).
export const media = {
  assets: new PrismaAssetRepository(),
};

let cachedStorage: MediaStorage | null = null;

export function getMediaStorage(): MediaStorage {
  if (cachedStorage) return cachedStorage;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.MEDIA_BUCKET;

  if (!supabaseUrl || !serviceRoleKey || !bucket) {
    throw new Error(
      "Faltan las env vars de Supabase Storage (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MEDIA_BUCKET) — ver docs/roadmap/landing-editor-v2.md Fase 5."
    );
  }

  cachedStorage = new SupabaseStorageMediaAdapter({ supabaseUrl, serviceRoleKey, bucket });
  return cachedStorage;
}
