import type {
  AgentAuditLogEntry,
  AgentAuditLogRepository,
  ListAgentAuditLogInput,
} from "../../../application/agent-access/ports/agent-audit-log-repository.port";
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

  async list(input: ListAgentAuditLogInput) {
    const rows = await prisma.agentAuditLog.findMany({
      where: input.apiClientId !== undefined ? { apiClientId: input.apiClientId } : undefined,
      orderBy: { createdAt: "desc" },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }
}
