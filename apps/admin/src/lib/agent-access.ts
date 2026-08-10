import {
  NodeApiKeyHasher,
  NodeApiKeySecretGenerator,
  PrismaAgentAuditLogRepository,
  PrismaApiClientRepository,
  PrismaApiKeyRepository,
} from "@repo/core/infrastructure";

// Composition root de apps/admin para el panel /agents (F6). A diferencia
// de apps/agent-api, corre con el DATABASE_URL de rol `postgres` (el mismo
// que usa `commerce`) — tiene los permisos de mutación de identidad que
// `agent_api_role` deliberadamente no tiene (crear/revocar/rotar,
// leer AgentAuditLog).
export const agentAccess = {
  apiClients: new PrismaApiClientRepository(),
  apiKeys: new PrismaApiKeyRepository(),
  agentAuditLogs: new PrismaAgentAuditLogRepository(),
  hasher: new NodeApiKeyHasher(),
  secretGenerator: new NodeApiKeySecretGenerator(),
};
