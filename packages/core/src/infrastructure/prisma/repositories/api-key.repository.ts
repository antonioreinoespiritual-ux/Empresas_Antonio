import type { ApiKey } from "../../../domain";
import type { ApiKeyRepository, IssueApiKeyRecordInput } from "../../../application/agent-access/ports/api-key-repository.port";
import type { AuditActor } from "../../../application/shared/audit-actor";
import { prisma } from "../client";

export class PrismaApiKeyRepository implements ApiKeyRepository {
  async findById(id: string): Promise<ApiKey | null> {
    return prisma.apiKey.findUnique({ where: { id } });
  }

  async findByPrefix(keyPrefix: string): Promise<ApiKey | null> {
    return prisma.apiKey.findUnique({ where: { keyPrefix } });
  }

  async listByClient(apiClientId: string): Promise<ApiKey[]> {
    return prisma.apiKey.findMany({ where: { apiClientId }, orderBy: { createdAt: "desc" } });
  }

  async issue(input: IssueApiKeyRecordInput, actor: AuditActor): Promise<ApiKey> {
    return prisma.$transaction(async (tx) => {
      const key = await tx.apiKey.create({
        data: {
          apiClientId: input.apiClientId,
          keyPrefix: input.keyPrefix,
          secretHash: input.secretHash,
          // Siempre un array explícito: a diferencia de ApiClient.allowedOfferIds,
          // en ApiKey.scopes no existe (ni debe existir) un significado de
          // "null = todos los scopes" — sería otorgar todos los permisos por
          // omisión. Una key sin scopes es [] (sin permisos), nunca null.
          scopes: input.scopes,
          expiresAt: input.expiresAt ?? null,
          rateLimitOverride: input.rateLimitOverride ?? null,
        },
      });
      // Nunca se audita secretHash ni el secreto en claro (que ni siquiera
      // llega a esta capa) — solo metadatos de qué se creó.
      await tx.auditLog.create({
        data: {
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "api_key.issued",
          entity: "ApiKey",
          entityId: key.id,
          diff: { apiClientId: key.apiClientId, keyPrefix: key.keyPrefix, scopes: key.scopes, expiresAt: key.expiresAt },
        },
      });
      return key;
    });
  }

  async revoke(id: string, actor: AuditActor): Promise<ApiKey> {
    return prisma.$transaction(async (tx) => {
      const before = await tx.apiKey.findUniqueOrThrow({ where: { id } });
      if (before.revokedAt !== null) {
        // Ya revocada: no-op, no se pisa el revokedAt original ni se duplica el audit log.
        return before;
      }

      const revoked = await tx.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "api_key.revoked",
          entity: "ApiKey",
          entityId: id,
          diff: { revokedAt: revoked.revokedAt },
        },
      });
      return revoked;
    });
  }
}
