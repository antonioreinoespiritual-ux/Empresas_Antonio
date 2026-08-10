export interface AgentAuditLogEntry {
  requestId: string;
  apiClientId: string;
  apiKeyId?: string | null;
  method: string;
  resourceType: string;
  resourceId?: string | null;
  statusCode: number;
  latencyMs: number;
  outcome: string;
  /** Resumen redactado — nunca el body crudo ni el header Authorization. */
  changeSummary?: unknown;
}

/**
 * Auditoría de lo que un agente YA autenticado hace a través de
 * apps/agent-api. Requiere apiClientId resuelto — los intentos que no
 * llegan a identificar ninguna key (header ausente/malformado, prefix
 * desconocido, kill switch global) no tienen una fila que auditar aquí por
 * diseño; ver docs/roadmap/agent-access-layer.md, cierre de F1.
 */
export interface AgentAuditLogRepository {
  record(entry: AgentAuditLogEntry): Promise<void>;
}
