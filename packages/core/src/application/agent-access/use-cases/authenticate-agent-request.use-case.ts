import { apiKeyUnusableReason, isClientUsable, parseBearerToken } from "../../../domain";
import type { AgentAccessDenialReason, AgentPrincipal } from "../../../domain";
import type { ApiClientRepository } from "../ports/api-client-repository.port";
import type { ApiKeyRepository } from "../ports/api-key-repository.port";
import type { ApiKeyHasher } from "../ports/api-key-crypto.port";

export interface AuthenticateAgentRequestDeps {
  apiClients: ApiClientRepository;
  apiKeys: ApiKeyRepository;
  hasher: ApiKeyHasher;
}

export interface AuthenticateAgentRequestInput {
  authorizationHeader: string | null | undefined;
  now: Date;
  /** Kill switch global — se evalúa antes de tocar la base. */
  killSwitchEngaged: boolean;
}

export type AuthenticateAgentRequestResult =
  | { ok: true; principal: AgentPrincipal }
  | {
      ok: false;
      reason: AgentAccessDenialReason;
      /** Presentes solo si se llegó a resolver una ApiKey — ver AgentAuditLogRepository. */
      apiClientId?: string;
      apiKeyId?: string;
    };

/**
 * Único camino de autenticación de apps/agent-api (F1). Nunca distingue en
 * la respuesta al agente si el prefix no existía o si el secreto no
 * coincidía — ambos son "invalid_credentials" para no filtrar qué mitad
 * del bearer token era incorrecta.
 */
export async function authenticateAgentRequest(
  deps: AuthenticateAgentRequestDeps,
  input: AuthenticateAgentRequestInput
): Promise<AuthenticateAgentRequestResult> {
  if (input.killSwitchEngaged) {
    return { ok: false, reason: "kill_switch_engaged" };
  }

  const parsed = parseBearerToken(input.authorizationHeader);
  if (!parsed) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const key = await deps.apiKeys.findByPrefix(parsed.keyPrefix);
  if (!key || !deps.hasher.verify(parsed.secret, key.secretHash)) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const unusable = apiKeyUnusableReason(key, input.now);
  if (unusable === "revoked") {
    return { ok: false, reason: "key_revoked", apiClientId: key.apiClientId, apiKeyId: key.id };
  }
  if (unusable === "expired") {
    return { ok: false, reason: "key_expired", apiClientId: key.apiClientId, apiKeyId: key.id };
  }

  const client = await deps.apiClients.findById(key.apiClientId);
  if (!client) {
    // Invariante violado (FK apiClientId -> ApiClient), no una denegación normal.
    throw new Error(`ApiKey ${key.id} referencia un ApiClient inexistente (${key.apiClientId})`);
  }
  if (!isClientUsable(client)) {
    return { ok: false, reason: "client_suspended", apiClientId: client.id, apiKeyId: key.id };
  }

  return {
    ok: true,
    principal: {
      apiClientId: client.id,
      apiKeyId: key.id,
      clientName: client.name,
      scopes: key.scopes,
      allowedOfferIds: client.allowedOfferIds,
      forceReadOnly: client.forceReadOnly,
    },
  };
}
