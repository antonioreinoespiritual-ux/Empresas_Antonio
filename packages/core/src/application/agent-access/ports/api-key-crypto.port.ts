/** Hasheo del secreto de una ApiKey. Nunca se persiste el secreto en claro. */
export interface ApiKeyHasher {
  hash(secret: string): string;
  verify(secret: string, hash: string): boolean;
}

export interface ApiKeySecretMaterial {
  /** Público, indexado, no secreto — se muestra truncado en el panel. */
  keyPrefix: string;
  /** Alta entropía, solo existe en memoria hasta que se hashea. */
  secret: string;
}

export interface ApiKeySecretGenerator {
  generate(): ApiKeySecretMaterial;
}
