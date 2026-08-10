export interface ApiKey {
  id: string;
  apiClientId: string;
  keyPrefix: string;
  secretHash: string;
  scopes: string[];
  expiresAt: Date | null;
  revokedAt: Date | null;
  rateLimitOverride: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ApiKeyUnusableReason = "revoked" | "expired";

/** Kill switch por key: revocación explícita o expiración por tiempo. */
export function apiKeyUnusableReason(key: ApiKey, now: Date): ApiKeyUnusableReason | null {
  if (key.revokedAt !== null) return "revoked";
  if (key.expiresAt !== null && now >= key.expiresAt) return "expired";
  return null;
}

export function isKeyUsable(key: ApiKey, now: Date): boolean {
  return apiKeyUnusableReason(key, now) === null;
}

export function hasScope(key: ApiKey, scope: string): boolean {
  return key.scopes.includes(scope);
}
