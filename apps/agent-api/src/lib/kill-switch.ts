import { get } from "@vercel/edge-config";

const CACHE_TTL_MS = 15_000;

let cache: { engaged: boolean; expiresAt: number } | null = null;

/**
 * Kill switch global (F1, retrofit PLAN-AGENT-API-01): señal primaria vía
 * Vercel Edge Config (clave `agent_api_kill_switch: boolean`), sin
 * necesidad de redeploy — propagación de Edge Config + hasta 15s de caché
 * local en memoria ≈ menos de 30s de activar el switch a que toda
 * instancia lo respete. `AGENT_API_KILL_SWITCH` (env var, requiere
 * redeploy) es un segundo lever independiente, chequeado en OR — nunca el
 * mecanismo operativo principal, solo un respaldo de último recurso.
 *
 * Fail-closed: si la lectura a Edge Config falla, se trata como activado
 * (503) sin importar si había un valor cacheado previo — apps/agent-api no
 * es ruta crítica de checkout/admin, negar de más es más seguro que negar
 * de menos. Se llama siempre antes de tocar Prisma.
 */
export async function isKillSwitchEngaged(): Promise<boolean> {
  if (process.env.AGENT_API_KILL_SWITCH === "true") return true;

  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.engaged;

  // Sin EDGE_CONFIG configurado (ej. local/dev sin el store conectado) no
  // hay otra señal que consultar — el env var ya se chequeó arriba.
  if (!process.env.EDGE_CONFIG) return false;

  try {
    const engaged = (await get<boolean>("agent_api_kill_switch")) === true;
    cache = { engaged, expiresAt: now + CACHE_TTL_MS };
    return engaged;
  } catch (error) {
    console.error("No se pudo leer agent_api_kill_switch de Edge Config — fail-closed (503)", error);
    return true;
  }
}
