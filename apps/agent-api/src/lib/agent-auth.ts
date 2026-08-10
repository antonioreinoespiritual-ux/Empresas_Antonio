import { randomUUID } from "node:crypto";
import { authenticateAgentRequest } from "@repo/core/application";
import type { AgentAccessDenialReason } from "@repo/core/domain";
import { agentAccess } from "./agent-access";

const DENIAL_STATUS_CODE: Record<AgentAccessDenialReason, number> = {
  kill_switch_engaged: 503,
  invalid_credentials: 401,
  key_revoked: 401,
  key_expired: 401,
  client_suspended: 403,
  read_only: 403,
  missing_scope: 403,
  offer_not_allowed: 403,
};

export function denialStatusCode(reason: AgentAccessDenialReason): number {
  return DENIAL_STATUS_CODE[reason];
}

/**
 * Punto único de autenticación para rutas de apps/agent-api. Kill switch
 * global vía AGENT_API_KILL_SWITCH — leído acá (infraestructura/app), nunca
 * dentro de application/domain, para que authenticateAgentRequest siga
 * siendo puro/testeable sin variables de entorno.
 */
export async function authenticateIncomingRequest(authorizationHeader: string | null) {
  const requestId = randomUUID();
  const result = await authenticateAgentRequest(
    { apiClients: agentAccess.apiClients, apiKeys: agentAccess.apiKeys, hasher: agentAccess.hasher },
    {
      authorizationHeader,
      now: new Date(),
      killSwitchEngaged: process.env.AGENT_API_KILL_SWITCH === "true",
    }
  );
  return { requestId, result };
}

export interface RecordAgentAuditLogParams {
  requestId: string;
  apiClientId: string;
  apiKeyId?: string | null;
  method: string;
  resourceType: string;
  resourceId?: string | null;
  statusCode: number;
  latencyMs: number;
  outcome: string;
  changeSummary?: unknown;
}

/**
 * Best-effort a propósito: audita una request ya resuelta (lectura), no
 * hay ninguna mutación con la que deba ser atómica. La atomicidad
 * auditoría+mutación es responsabilidad de los repositorios de
 * identidad (ver PrismaApiClientRepository/PrismaApiKeyRepository), no de
 * este logging de requests.
 */
export async function recordAgentAuditLog(params: RecordAgentAuditLogParams): Promise<void> {
  try {
    await agentAccess.agentAuditLogs.record(params);
  } catch (error) {
    console.error("No se pudo escribir AgentAuditLog", { ...params, error });
  }
}
