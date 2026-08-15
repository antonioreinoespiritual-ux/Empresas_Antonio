import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CreateUploadUrlInput, CreateUploadUrlResult, MediaStorage } from "../../application";

// Fase 5 (ARCH-LANDING-EDITOR-02 §7, decisión P-2). El bucket debe existir
// de antemano como PÚBLICO (paso exclusivo de Antonio, igual que crear
// agent_api_role o el Edge Config del kill switch) — este adaptador nunca
// crea ni configura el bucket, solo lo usa.
//
// `createSignedUploadUrl` de Supabase Storage devuelve una `signedUrl` ya
// pensada para que el cliente final (agente o admin) haga un PUT directo
// del binario contra ella, sin pasar por esta función serverless — el
// mismo flujo de dos pasos descrito en §7 (subir binario → registrar Asset)
// funciona con un `fetch(uploadUrl, {method: "PUT", body, headers:
// {"Content-Type": contentType}})` plano, sin necesitar el SDK de Supabase
// del lado del cliente.
export class SupabaseStorageMediaAdapter implements MediaStorage {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(params: { supabaseUrl: string; serviceRoleKey: string; bucket: string }) {
    this.client = createClient(params.supabaseUrl, params.serviceRoleKey);
    this.bucket = params.bucket;
  }

  async createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult> {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUploadUrl(input.path);
    if (error || !data) {
      throw new Error(`No se pudo generar la URL de subida firmada: ${error?.message ?? "respuesta vacía de Supabase Storage"}`);
    }
    // Supabase no informa el TTL exacto de la firma en la respuesta — 2
    // horas es un margen amplio y arbitrario para que el cliente complete
    // la subida; el propio token firmado, no este valor, es lo que Supabase
    // realmente vence del lado del servidor.
    return { uploadUrl: data.signedUrl, expiresAt: new Date(Date.now() + 2 * 60 * 60_000) };
  }

  publicUrlFor(path: string): string {
    const { data } = this.client.storage.from(this.bucket).getPublicUrl(path);
    return data.publicUrl;
  }
}
