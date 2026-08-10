/** `If-Match` transporta el `expectedVersion` de la CAS (ETag-style) en las rutas de bloques/reorder/PATCH de F4 — null si falta o no es un entero. */
export function parseIfMatch(request: Request): number | null {
  const raw = request.headers.get("if-match");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
}
