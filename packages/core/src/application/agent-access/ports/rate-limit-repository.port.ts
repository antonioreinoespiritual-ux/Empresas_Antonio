export interface ConsumeRateLimitInput {
  apiKeyId: string;
  /** Identifica qué se limita (p. ej. la ruta) — la ventana temporal ya está incluida acá, no es un campo separado. */
  bucketKey: string;
  windowStart: Date;
}

/**
 * consume() debe ser una única sentencia atómica en Postgres
 * (INSERT..ON CONFLICT..DO UPDATE), nunca "SELECT count, decidir, UPDATE"
 * en pasos separados — eso es exactamente la race condition que el rate
 * limiting existe para evitar.
 */
export interface RateLimitRepository {
  consume(input: ConsumeRateLimitInput): Promise<{ count: number }>;
}
