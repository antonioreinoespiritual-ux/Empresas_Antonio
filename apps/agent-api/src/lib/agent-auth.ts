import { randomUUID } from "node:crypto";
import { authenticateAgentRequest, enforceRateLimit } from "@repo/core/application";
import { RateLimitExceededError, type AgentAccessDenialReason } from "@repo/core/domain";
import { agentAccess } from "./agent-access";
import { isKillSwitchEngaged } from "./kill-switch";

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
 * Un requestId propio del llamador (X-Request-Id) permite correlacionar
 * sus propios logs con AgentAuditLog; si no lo manda, se genera uno acá.
 * Se devuelve siempre en la respuesta (ver rutas) para que el llamador
 * sepa cuál quedó registrado incluso cuando lo generamos nosotros.
 */
export function resolveRequestId(request: Request): string {
  const provided = request.headers.get("x-request-id");
  return provided && provided.trim().length > 0 ? provided.trim() : randomUUID();
}

/**
 * Punto único de autenticación para rutas de apps/agent-api. Kill switch
 * global vía Edge Config + env var de respaldo (ver kill-switch.ts) —
 * leído acá (infraestructura/app), nunca dentro de application/domain, para
 * que authenticateAgentRequest siga siendo puro/testeable sin depender de
 * Edge Config ni de variables de entorno. Se evalúa antes que cualquier
 * llamada a Prisma dentro de authenticateAgentRequest.
 */
export async function authenticateIncomingRequest(authorizationHeader: string | null) {
  const result = await authenticateAgentRequest(
    { apiClients: agentAccess.apiClients, apiKeys: agentAccess.apiKeys, hasher: agentAccess.hasher },
    {
      authorizationHeader,
      now: new Date(),
      killSwitchEngaged: await isKillSwitchEngaged(),
    }
  );
  return { result };
}

export interface RateLimitCheck {
  allowed: boolean;
  limit: number;
  count: number;
  remaining: number;
}

/**
 * Aplica el rate limit atómico (F2) a una ApiKey ya autenticada, por ruta.
 * Nunca lanza — RateLimitExceededError se traduce a {allowed:false} para
 * que la ruta decida el status code (429) sin acoplarse al tipo de error.
 */
export async function checkRateLimit(params: {
  apiKeyId: string;
  routeKey: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitCheck> {
  try {
    const status = await enforceRateLimit(
      { rateLimits: agentAccess.rateLimits },
      { apiKeyId: params.apiKeyId, routeKey: params.routeKey, limit: params.limit, windowMs: params.windowMs, now: new Date() }
    );
    return { allowed: true, ...status };
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return { allowed: false, limit: params.limit, count: params.limit + 1, remaining: 0 };
    }
    throw error;
  }
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
