// Puerto hexagonal (Fase 5, §7) — mismo patrón que PaymentProvider: el
// dominio/aplicación no conoce Supabase Storage, solo esta interfaz. El
// adaptador concreto vive en infrastructure/media/.
export interface CreateUploadUrlInput {
  /** Clave de storage generada por el servidor — nunca un path que mande el cliente. */
  path: string;
  contentType: string;
}

export interface CreateUploadUrlResult {
  /** URL a la que el cliente hace PUT del binario directo, sin pasar por la función serverless. */
  uploadUrl: string;
  expiresAt: Date;
}

export interface MediaStorage {
  createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult>;
  /** URL pública final de un `path` ya subido — la computa el servidor, nunca el cliente (§20, no confiar una URL suelta). */
  publicUrlFor(path: string): string;
}
