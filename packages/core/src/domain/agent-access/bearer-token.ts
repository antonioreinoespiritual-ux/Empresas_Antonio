export interface ParsedBearerToken {
  keyPrefix: string;
  secret: string;
}

const BEARER_PREFIX = "Bearer ";

/**
 * "Bearer <keyPrefix>.<secret>" — keyPrefix es el identificador público
 * indexado de la ApiKey (columna keyPrefix), secret es el material de alta
 * entropía que solo existe hasheado en la base. Cualquier formato distinto
 * (header ausente, sin "Bearer ", sin ".", prefix o secret vacíos) es
 * inválido y nunca se intenta interpretar parcialmente.
 */
export function parseBearerToken(header: string | null | undefined): ParsedBearerToken | null {
  if (!header || !header.startsWith(BEARER_PREFIX)) return null;

  const token = header.slice(BEARER_PREFIX.length);
  const separatorIndex = token.indexOf(".");
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) return null;

  return {
    keyPrefix: token.slice(0, separatorIndex),
    secret: token.slice(separatorIndex + 1),
  };
}
