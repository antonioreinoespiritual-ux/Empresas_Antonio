import {
  IDEMPOTENCY_PENDING_STATUS,
  type IdempotencyRecordSnapshot,
  type IdempotencyRepository,
  type ReserveIdempotencyKeyResult,
} from "../../../application/agent-access/ports/idempotency-repository.port";
import { prisma } from "../client";
import { isUniqueConstraintViolation } from "../is-unique-constraint-violation";
import type { Prisma } from "@prisma/client";

export class PrismaIdempotencyRecordRepository implements IdempotencyRepository {
  async reserve(input: {
    apiClientId: string;
    idempotencyKey: string;
    requestHash: string;
    expiresAt: Date;
  }): Promise<ReserveIdempotencyKeyResult> {
    try {
      // INSERT con placeholder — el UNIQUE (apiClientId, idempotencyKey) es
      // lo que hace esto atómico: entre N llamadas concurrentes con la
      // misma key, Postgres deja pasar exactamente un INSERT y rechaza el
      // resto por violación de constraint, sin ninguna ventana de carrera.
      const created = await prisma.idempotencyRecord.create({
        data: {
          apiClientId: input.apiClientId,
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
          responseStatus: IDEMPOTENCY_PENDING_STATUS,
          responseBody: {},
          expiresAt: input.expiresAt,
        },
      });
      return { outcome: "reserved", id: created.id };
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      const existing = await prisma.idempotencyRecord.findUniqueOrThrow({
        where: { apiClientId_idempotencyKey: { apiClientId: input.apiClientId, idempotencyKey: input.idempotencyKey } },
      });
      return { outcome: "existing", record: existing };
    }
  }

  async finalize(id: string, result: { responseStatus: number; responseBody: unknown }): Promise<void> {
    await prisma.idempotencyRecord.update({
      where: { id },
      data: {
        responseStatus: result.responseStatus,
        responseBody: result.responseBody as Prisma.InputJsonValue,
      },
    });
  }

  async findByKey(apiClientId: string, idempotencyKey: string): Promise<IdempotencyRecordSnapshot | null> {
    return prisma.idempotencyRecord.findUnique({
      where: { apiClientId_idempotencyKey: { apiClientId, idempotencyKey } },
    });
  }
}
