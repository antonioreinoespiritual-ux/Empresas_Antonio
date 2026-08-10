import { createHash } from "node:crypto";

/**
 * Hash del payload de una request para comparar Idempotency-Key + mismo
 * cuerpo vs. Idempotency-Key + cuerpo distinto. JSON.stringify no garantiza
 * un orden canónico de claves entre objetos con distinto orden de
 * inserción pero mismo contenido — suficiente para esta capa (el llamador
 * controla la forma exacta del payload), no es un hash canónico general.
 */
export function hashRequestPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
