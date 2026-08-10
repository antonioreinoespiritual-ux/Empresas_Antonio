import { NotFoundError } from "../../../domain";
import type { ApiKey } from "../../../domain";
import type { AuditActor } from "../../shared/audit-actor";
import type { ApiClientRepository } from "../ports/api-client-repository.port";
import type { ApiKeyRepository } from "../ports/api-key-repository.port";
import type { ApiKeyHasher, ApiKeySecretGenerator } from "../ports/api-key-crypto.port";

export interface IssueApiKeyDeps {
  apiClients: ApiClientRepository;
  apiKeys: ApiKeyRepository;
  hasher: ApiKeyHasher;
  secretGenerator: ApiKeySecretGenerator;
}

export interface IssueApiKeyInput {
  apiClientId: string;
  scopes: string[];
  expiresAt?: Date | null;
  rateLimitOverride?: number | null;
}

export interface IssueApiKeyResult {
  apiKey: ApiKey;
  /** "<keyPrefix>.<secret>" en claro — se devuelve esta única vez, no se puede recuperar después. */
  plaintextKey: string;
}

/**
 * Orquesta la generación de credenciales (ADR "auth bearer hasheada"): el
 * secreto en claro nunca sale de esta función hacia la capa de persistencia
 * — solo su hash. Falla si el ApiClient no existe; issue() en sí no valida
 * status/forceReadOnly porque preparar una key antes de activar el cliente
 * es un flujo válido.
 */
export async function issueApiKey(
  deps: IssueApiKeyDeps,
  input: IssueApiKeyInput,
  actor: AuditActor
): Promise<IssueApiKeyResult> {
  const client = await deps.apiClients.findById(input.apiClientId);
  if (!client) {
    throw new NotFoundError(`ApiClient ${input.apiClientId} no existe`);
  }

  const material = deps.secretGenerator.generate();
  const secretHash = deps.hasher.hash(material.secret);

  const apiKey = await deps.apiKeys.issue(
    {
      apiClientId: input.apiClientId,
      keyPrefix: material.keyPrefix,
      secretHash,
      scopes: input.scopes,
      expiresAt: input.expiresAt ?? null,
      rateLimitOverride: input.rateLimitOverride ?? null,
    },
    actor
  );

  return { apiKey, plaintextKey: `${material.keyPrefix}.${material.secret}` };
}
