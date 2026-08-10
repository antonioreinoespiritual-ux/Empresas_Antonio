import type { ApiKey } from "../../../domain";
import type { AuditActor } from "../../shared/audit-actor";

export interface IssueApiKeyRecordInput {
  apiClientId: string;
  /** Identificador público (indexado, no secreto) — ya generado por el use-case. */
  keyPrefix: string;
  /** Hash del secreto — el secreto en claro nunca llega a esta capa. */
  secretHash: string;
  scopes: string[];
  expiresAt?: Date | null;
  rateLimitOverride?: number | null;
}

export interface ApiKeyRepository {
  findById(id: string): Promise<ApiKey | null>;
  findByPrefix(keyPrefix: string): Promise<ApiKey | null>;
  listByClient(apiClientId: string): Promise<ApiKey[]>;
  issue(input: IssueApiKeyRecordInput, actor: AuditActor): Promise<ApiKey>;
  /** No-op auditado si la key ya estaba revocada (nunca "re-revoca" ni pisa el revokedAt original). */
  revoke(id: string, actor: AuditActor): Promise<ApiKey>;
}
