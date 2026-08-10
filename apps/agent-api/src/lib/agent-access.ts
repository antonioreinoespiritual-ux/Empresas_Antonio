import {
  NodeApiKeyHasher,
  NodeApiKeySecretGenerator,
  PrismaAgentAuditLogRepository,
  PrismaApiClientRepository,
  PrismaApiKeyRepository,
} from "@repo/core/infrastructure";

// Composition root de apps/agent-api (F1 — identidad de agentes).
//
// En runtime, apps/agent-api debe conectarse con `agent_api_role` (ver
// prisma/agent-access-layer/create_agent_api_role.sql) vía su propio
// DATABASE_URL en el entorno de despliegue — ese rol solo tiene SELECT
// sobre api_clients/api_keys e INSERT sobre agent_audit_logs. Los métodos
// de mutación de identidad (create/issue/revoke/setStatus/...) están
// disponibles en estas clases porque implementan la interfaz completa del
// puerto, pero agent_api_role no tiene permisos para ejecutarlos — fallan
// en Postgres si algún código de esta app llegara a invocarlos por error.
// Esas mutaciones se ejecutan exclusivamente fuera de apps/agent-api (hoy:
// packages/core/scripts/manage-agent-clients.mjs, con el DATABASE_URL de
// rol `postgres`).
export const agentAccess = {
  apiClients: new PrismaApiClientRepository(),
  apiKeys: new PrismaApiKeyRepository(),
  agentAuditLogs: new PrismaAgentAuditLogRepository(),
  hasher: new NodeApiKeyHasher(),
  secretGenerator: new NodeApiKeySecretGenerator(),
};
