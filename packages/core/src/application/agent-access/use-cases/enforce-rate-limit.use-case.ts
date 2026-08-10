import { RateLimitExceededError } from "../../../domain";
import type { RateLimitRepository } from "../ports/rate-limit-repository.port";

export interface EnforceRateLimitDeps {
  rateLimits: RateLimitRepository;
}

export interface EnforceRateLimitInput {
  apiKeyId: string;
  /** Qué se limita — normalmente la ruta u operación (p. ej. "pages:update"). */
  routeKey: string;
  limit: number;
  windowMs: number;
  now: Date;
}

export interface RateLimitStatus {
  limit: number;
  count: number;
  remaining: number;
}

/**
 * Ventana fija: cada bloque de windowMs tiene su propio bucketKey (incluye
 * el inicio de ventana), así que consume() nunca necesita decidir si debe
 * resetear un contador — cada ventana nueva es, literalmente, una fila
 * nueva. Bajo N requests concurrentes en la misma ventana, Postgres
 * serializa los UPDATE sobre esa fila (row lock) — count nunca puede
 * "saltarse" ni duplicarse un valor, sin importar la concurrencia real.
 */
export async function enforceRateLimit(deps: EnforceRateLimitDeps, input: EnforceRateLimitInput): Promise<RateLimitStatus> {
  const windowStartMs = Math.floor(input.now.getTime() / input.windowMs) * input.windowMs;
  const bucketKey = `${input.routeKey}:${windowStartMs}`;

  const { count } = await deps.rateLimits.consume({
    apiKeyId: input.apiKeyId,
    bucketKey,
    windowStart: new Date(windowStartMs),
  });

  if (count > input.limit) {
    throw new RateLimitExceededError(
      `Límite de ${input.limit} solicitudes por ventana excedido para "${input.routeKey}" (conteo: ${count})`
    );
  }

  return { limit: input.limit, count, remaining: Math.max(0, input.limit - count) };
}
