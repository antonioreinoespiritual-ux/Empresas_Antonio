import type { MediaStorage } from "@repo/core/application";
import { SupabaseStorageMediaAdapter } from "@repo/core/infrastructure";

// Construcción perezosa, no en `agent-access.ts` (F1): a diferencia de los
// demás repos ahí (que solo envuelven el `prisma` compartido, sin
// credenciales propias), este adaptador requiere sus propias env vars de
// Supabase Storage. Instanciarlo eager en agent-access.ts rompería TODAS
// las rutas de esta app si esas env vars faltan (p. ej. en dev local antes
// de que Antonio provisione el bucket) — acá solo falla, con un 500 claro,
// si una ruta de /media realmente lo necesita.
let cached: MediaStorage | null = null;

export function getMediaStorage(): MediaStorage {
  if (cached) return cached;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.MEDIA_BUCKET;

  if (!supabaseUrl || !serviceRoleKey || !bucket) {
    throw new Error(
      "Faltan las env vars de Supabase Storage (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MEDIA_BUCKET) — ver docs/roadmap/landing-editor-v2.md Fase 5."
    );
  }

  cached = new SupabaseStorageMediaAdapter({ supabaseUrl, serviceRoleKey, bucket });
  return cached;
}
