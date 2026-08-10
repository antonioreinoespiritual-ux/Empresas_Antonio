export interface PreviewToken {
  id: string;
  pageId: string;
  tokenId: string;
  secretHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdByApiKeyId: string | null;
  createdAt: Date;
}

export function isPreviewTokenUsable(token: PreviewToken, now: Date): boolean {
  return token.revokedAt === null && now < token.expiresAt;
}

export interface ParsedPreviewToken {
  tokenId: string;
  secret: string;
}

/**
 * "<tokenId>.<secret>" — a diferencia del bearer de ApiKey, este viaja en
 * un path de URL (/preview/[token]), no en un header Authorization, así
 * que no lleva el prefijo "Bearer ". Mismo criterio de invalidez estricta:
 * sin ".", o con alguna mitad vacía, nunca se interpreta parcialmente.
 */
export function parsePreviewToken(raw: string | null | undefined): ParsedPreviewToken | null {
  if (!raw) return null;
  const separatorIndex = raw.indexOf(".");
  if (separatorIndex <= 0 || separatorIndex === raw.length - 1) return null;
  return { tokenId: raw.slice(0, separatorIndex), secret: raw.slice(separatorIndex + 1) };
}
