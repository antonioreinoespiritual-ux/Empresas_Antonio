/**
 * Identidad resuelta de un agente autenticado — combina lo que importa de
 * ApiClient y ApiKey para tomar decisiones de autorización sin volver a
 * tocar Prisma. Nunca incluye secretHash ni ningún dato sensible.
 */
export interface AgentPrincipal {
  apiClientId: string;
  apiKeyId: string;
  clientName: string;
  scopes: string[];
  allowedOfferIds: string[] | null;
  forceReadOnly: boolean;
}

export type AgentAccessDenialReason =
  | "kill_switch_engaged"
  | "invalid_credentials"
  | "key_revoked"
  | "key_expired"
  | "client_suspended"
  | "read_only"
  | "missing_scope"
  | "offer_not_allowed";

export type AgentAuthorizeInput = {
  /** Verbo/permiso requerido por el recurso al que se accede. Ausente = cualquier key autenticada puede pasar (p. ej. introspección de identidad). */
  scope?: string;
  /** Offer sobre la que se actúa, si aplica. Ausente = la acción no está acotada a una Offer puntual. */
  offerId?: string;
  /** true si la acción escribe/muta algo — forceReadOnly la bloquea sin importar los scopes de la key. */
  isWrite: boolean;
};

export type AgentAuthorizeResult = { ok: true } | { ok: false; reason: AgentAccessDenialReason };

/**
 * Decisión de autorización pura (sin I/O) sobre un AgentPrincipal ya
 * autenticado. Separada de la autenticación (que sí requiere Prisma/hash)
 * para poder testearla exhaustivamente sin base de datos.
 */
export function authorizeAgentAction(
  principal: AgentPrincipal,
  input: AgentAuthorizeInput
): AgentAuthorizeResult {
  if (input.isWrite && principal.forceReadOnly) {
    return { ok: false, reason: "read_only" };
  }
  if (input.scope !== undefined && !principal.scopes.includes(input.scope)) {
    return { ok: false, reason: "missing_scope" };
  }
  if (input.offerId !== undefined) {
    const allowed = principal.allowedOfferIds === null || principal.allowedOfferIds.includes(input.offerId);
    if (!allowed) return { ok: false, reason: "offer_not_allowed" };
  }
  return { ok: true };
}
