import type { ApiClient, ApiClientStatus } from "../../../domain";
import type { AuditActor } from "../../shared/audit-actor";

export interface CreateApiClientInput {
  name: string;
  description?: string | null;
  /** Omitido o null = todas las Offers. */
  allowedOfferIds?: string[] | null;
  forceReadOnly?: boolean;
  createdByAdminId: string;
}

/**
 * Cada mutación registra un AuditLog (genérico, actorType/actorId explícito
 * por llamada) en la misma transacción que el cambio — nunca "mejor
 * esfuerzo" después del hecho.
 */
export interface ApiClientRepository {
  findById(id: string): Promise<ApiClient | null>;
  list(): Promise<ApiClient[]>;
  create(input: CreateApiClientInput, actor: AuditActor): Promise<ApiClient>;
  /** Kill switch por cliente. No-op auditado si el status no cambia. */
  setStatus(id: string, status: ApiClientStatus, actor: AuditActor): Promise<ApiClient>;
  setForceReadOnly(id: string, forceReadOnly: boolean, actor: AuditActor): Promise<ApiClient>;
  /** null = todas las Offers; [] = ninguna; array = allow-list explícita. */
  setAllowedOfferIds(id: string, allowedOfferIds: string[] | null, actor: AuditActor): Promise<ApiClient>;
}
