import type { AgentAuditLogEntry, AgentAuditLogRepository } from "../../../application/agent-access/ports/agent-audit-log-repository.port";
import { prisma } from "../client";
import type { Prisma } from "@prisma/client";

export class PrismaAgentAuditLogRepository implements AgentAuditLogRepository {
  async record(entry: AgentAuditLogEntry): Promise<void> {
    await prisma.agentAuditLog.create({
      data: {
        requestId: entry.requestId,
        apiClientId: entry.apiClientId,
        apiKeyId: entry.apiKeyId ?? null,
        method: entry.method,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        statusCode: entry.statusCode,
        latencyMs: entry.latencyMs,
        outcome: entry.outcome,
        changeSummary: (entry.changeSummary ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
