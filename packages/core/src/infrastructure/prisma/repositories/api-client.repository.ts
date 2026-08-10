import type { ApiClient, ApiClientStatus } from "../../../domain";
import type { ApiClientRepository, CreateApiClientInput } from "../../../application/agent-access/ports/api-client-repository.port";
import type { AuditActor } from "../../../application/shared/audit-actor";
import { prisma } from "../client";

// Prisma Client tipa ApiClient.allowedOfferIds como `string[]` — nunca
// `string[] | null` — y colapsa un NULL de Postgres a `[]` al leer una
// columna de lista nullable (ver prisma/schema.prisma, comentario del campo:
// "null = todas las Offers; [] = ninguna"). No hay forma de recuperar el
// NULL real a través de `prisma.apiClient.findUnique`/`findMany` — por eso
// los métodos de lectura de esta clase usan SQL crudo únicamente para esta
// columna. El resto de la tabla se lee/escribe con la API normal de Prisma.
interface RawApiClientRow {
  id: string;
  name: string;
  description: string | null;
  status: ApiClientStatus;
  forceReadOnly: boolean;
  allowedOfferIds: string[] | null;
  createdByAdminId: string;
  createdAt: Date;
  updatedAt: Date;
}

const RAW_COLUMNS = `"id", "name", "description", "status", "forceReadOnly", "allowedOfferIds", "createdByAdminId", "createdAt", "updatedAt"`;

export class PrismaApiClientRepository implements ApiClientRepository {
  async findById(id: string): Promise<ApiClient | null> {
    const rows = await prisma.$queryRawUnsafe<RawApiClientRow[]>(
      `SELECT ${RAW_COLUMNS} FROM "api_clients" WHERE "id" = $1`,
      id
    );
    return rows[0] ?? null;
  }

  async list(): Promise<ApiClient[]> {
    return prisma.$queryRawUnsafe<RawApiClientRow[]>(
      `SELECT ${RAW_COLUMNS} FROM "api_clients" ORDER BY "createdAt" DESC`
    );
  }

  async create(input: CreateApiClientInput, actor: AuditActor): Promise<ApiClient> {
    // input.allowedOfferIds ausente/null: se omite del `data` de Prisma a
    // propósito, para que la columna quede en NULL (su default real en la
    // migración) en vez de que Prisma intente escribir un valor que ni
    // siquiera puede expresar (`null` no es un valor válido para este campo
    // en el tipo generado).
    const hasExplicitAllowedOfferIds = input.allowedOfferIds !== undefined && input.allowedOfferIds !== null;

    const created = await prisma.$transaction(async (tx) => {
      const client = await tx.apiClient.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          forceReadOnly: input.forceReadOnly ?? false,
          createdByAdminId: input.createdByAdminId,
          ...(hasExplicitAllowedOfferIds ? { allowedOfferIds: input.allowedOfferIds as string[] } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "api_client.created",
          entity: "ApiClient",
          entityId: client.id,
          diff: {
            name: client.name,
            forceReadOnly: client.forceReadOnly,
            allowedOfferIds: input.allowedOfferIds ?? null,
          },
        },
      });
      return client;
    });

    return {
      id: created.id,
      name: created.name,
      description: created.description,
      status: created.status,
      forceReadOnly: created.forceReadOnly,
      allowedOfferIds: input.allowedOfferIds ?? null,
      createdByAdminId: created.createdByAdminId,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async setStatus(id: string, status: ApiClientStatus, actor: AuditActor): Promise<ApiClient> {
    await prisma.$transaction(async (tx) => {
      await tx.apiClient.update({ where: { id }, data: { status } });
      await tx.auditLog.create({
        data: {
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "api_client.status_changed",
          entity: "ApiClient",
          entityId: id,
          diff: { status },
        },
      });
    });
    return this.mustFindById(id);
  }

  async setForceReadOnly(id: string, forceReadOnly: boolean, actor: AuditActor): Promise<ApiClient> {
    await prisma.$transaction(async (tx) => {
      await tx.apiClient.update({ where: { id }, data: { forceReadOnly } });
      await tx.auditLog.create({
        data: {
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "api_client.force_read_only_changed",
          entity: "ApiClient",
          entityId: id,
          diff: { forceReadOnly },
        },
      });
    });
    return this.mustFindById(id);
  }

  async setAllowedOfferIds(id: string, allowedOfferIds: string[] | null, actor: AuditActor): Promise<ApiClient> {
    await prisma.$transaction(async (tx) => {
      if (allowedOfferIds === null) {
        // Ver comentario de clase: Prisma no puede escribir `null` para este
        // campo a través de su API tipada — requiere SQL crudo para volver a
        // "todas las Offers" desde un allow-list previo.
        await tx.$executeRawUnsafe(`UPDATE "api_clients" SET "allowedOfferIds" = NULL, "updatedAt" = now() WHERE "id" = $1`, id);
      } else {
        await tx.apiClient.update({ where: { id }, data: { allowedOfferIds, updatedAt: new Date() } });
      }
      await tx.auditLog.create({
        data: {
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "api_client.allowed_offer_ids_changed",
          entity: "ApiClient",
          entityId: id,
          diff: { allowedOfferIds },
        },
      });
    });
    return this.mustFindById(id);
  }

  private async mustFindById(id: string): Promise<ApiClient> {
    const client = await this.findById(id);
    if (!client) throw new Error(`ApiClient ${id} no encontrado tras la actualización`);
    return client;
  }
}
