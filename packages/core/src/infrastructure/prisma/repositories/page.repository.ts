import { ConflictError, VersionConflictError } from "../../../domain";
import type { Page, PageKind, PageStatus } from "../../../domain";
import type {
  AgentPageAuditContext,
  CreatePageInput,
  ListPagesForAgentInput,
  PageRepository,
  UpdatePageWithVersionInput,
} from "../../../application/content/ports/page-repository.port";
import { prisma } from "../client";
import { isUniqueConstraintViolation } from "../is-unique-constraint-violation";
import type { Prisma } from "@prisma/client";

type PageRow = {
  id: string;
  offerId: string;
  kind: PageKind;
  slug: string | null;
  status: PageStatus;
  content: unknown;
  version: number;
  updatedAt: Date;
  variantGroupId: string | null;
  variantLabel: string | null;
};

const RETURNING_COLUMNS = `"id","offerId","kind","slug","status","content","version","updatedAt","variantGroupId","variantLabel"`;

export class PrismaPageRepository implements PageRepository {
  async findById(pageId: string): Promise<Page | null> {
    return prisma.page.findUnique({ where: { id: pageId } });
  }

  /**
   * La Page "primaria" (no una variante) — variantLabel NULL. El compound
   * unique cambió de (offerId, kind) a (offerId, kind, variantLabel) para
   * habilitar variantes reales (F4) — variantLabel: null sigue resolviendo
   * exactamente la misma fila que antes para toda Page no-variante.
   * findFirst en vez de findUnique: el tipo generado por Prisma para la
   * where-unique compuesta no acepta `null` en variantLabel aunque la
   * columna sí lo permita — el índice único parcial (migración
   * page_variant_label_unique) sigue garantizando como máximo una fila.
   */
  async findByOfferAndKind(offerId: string, kind: PageKind): Promise<Page | null> {
    return prisma.page.findFirst({ where: { offerId, kind, variantLabel: null } });
  }

  async findPublishedBySlug(slug: string): Promise<Page | null> {
    return prisma.page.findFirst({ where: { slug, kind: "LANDING", status: "PUBLISHED" } });
  }

  async listForAgent(input: ListPagesForAgentInput) {
    const where = {
      ...(input.allowedOfferIds !== null ? { offerId: { in: input.allowedOfferIds } } : {}),
      ...(input.offerId !== undefined ? { offerId: input.offerId } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
    };
    const rows = await prisma.page.findMany({
      where,
      orderBy: { id: "asc" },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }

  async createInitial(input: CreatePageInput): Promise<Page> {
    try {
      return await prisma.page.create({
        data: {
          offerId: input.offerId,
          kind: input.kind,
          slug: input.slug ?? null,
          content: input.content as Prisma.InputJsonValue,
          variantGroupId: input.variantGroupId ?? null,
          variantLabel: input.variantLabel ?? null,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictError(
          input.variantLabel
            ? `Ya existe una variante "${input.variantLabel}" de Page ${input.kind} para la Offer ${input.offerId}`
            : `Ya existe una Page ${input.kind} para la Offer ${input.offerId}`
        );
      }
      throw error;
    }
  }

  async createInitialAudited(input: CreatePageInput, audit: AgentPageAuditContext): Promise<Page> {
    try {
      return await prisma.$transaction(async (tx) => {
        const page = await tx.page.create({
          data: {
            offerId: input.offerId,
            kind: input.kind,
            slug: input.slug ?? null,
            content: input.content as Prisma.InputJsonValue,
            variantGroupId: input.variantGroupId ?? null,
            variantLabel: input.variantLabel ?? null,
          },
        });

        // Misma transacción que el INSERT de arriba — ver updateWithVersionAudited.
        await tx.agentAuditLog.create({
          data: {
            requestId: audit.requestId,
            apiClientId: audit.apiClientId,
            apiKeyId: audit.apiKeyId ?? null,
            method: "PAGE_CREATE",
            resourceType: "Page",
            resourceId: page.id,
            statusCode: 201,
            latencyMs: 0,
            outcome: "created",
            changeSummary: { offerId: page.offerId, kind: page.kind, version: page.version },
          },
        });

        return page;
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictError(
          input.variantLabel
            ? `Ya existe una variante "${input.variantLabel}" de Page ${input.kind} para la Offer ${input.offerId}`
            : `Ya existe una Page ${input.kind} para la Offer ${input.offerId}`
        );
      }
      throw error;
    }
  }

  // "variantLabel" IS NOT DISTINCT FROM $6 en vez de "=" — comparación
  // null-safe (F4): un "=" normal contra NULL nunca es true en SQL
  // estándar, así que la Page primaria (variantLabel NULL) nunca haría
  // match con un "=" directo. (offerId, kind) solas ya no identifican una
  // única fila desde que existen variantes — hace falta variantLabel acá
  // para no actualizar la fila equivocada.
  async updateWithVersion(input: UpdatePageWithVersionInput): Promise<Page> {
    const rows = await prisma.$queryRawUnsafe<PageRow[]>(
      `UPDATE "pages"
       SET "content" = $1::jsonb, "slug" = $2, "version" = "version" + 1, "updatedAt" = now()
       WHERE "offerId" = $3 AND "kind" = $4::"PageKind" AND "version" = $5 AND "variantLabel" IS NOT DISTINCT FROM $6
       RETURNING ${RETURNING_COLUMNS}`,
      JSON.stringify(input.content),
      input.slug ?? null,
      input.offerId,
      input.kind,
      input.expectedVersion,
      input.variantLabel ?? null
    );
    return this.requireCasRow(rows, input);
  }

  async updateWithVersionAudited(input: UpdatePageWithVersionInput, audit: AgentPageAuditContext): Promise<Page> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<PageRow[]>(
        `UPDATE "pages"
         SET "content" = $1::jsonb, "slug" = $2, "version" = "version" + 1, "updatedAt" = now()
         WHERE "offerId" = $3 AND "kind" = $4::"PageKind" AND "version" = $5 AND "variantLabel" IS NOT DISTINCT FROM $6
         RETURNING ${RETURNING_COLUMNS}`,
        JSON.stringify(input.content),
        input.slug ?? null,
        input.offerId,
        input.kind,
        input.expectedVersion,
        input.variantLabel ?? null
      );
      const page = this.requireCasRow(rows, input);

      // Misma transacción que el UPDATE de arriba: si esto falla, Prisma
      // revierte también la escritura de la Page — nunca queda una mutación
      // crítica sin su auditoría ni al revés.
      await tx.agentAuditLog.create({
        data: {
          requestId: audit.requestId,
          apiClientId: audit.apiClientId,
          apiKeyId: audit.apiKeyId ?? null,
          method: "PAGE_UPDATE",
          resourceType: "Page",
          resourceId: page.id,
          statusCode: 200,
          latencyMs: 0,
          outcome: "updated",
          changeSummary: { offerId: page.offerId, kind: page.kind, version: page.version },
        },
      });

      return page;
    });
  }

  async setStatus(pageId: string, status: PageStatus): Promise<void> {
    await prisma.page.update({ where: { id: pageId }, data: { status } });
  }

  private requireCasRow(rows: PageRow[], input: UpdatePageWithVersionInput): PageRow {
    const [row] = rows;
    if (!row) {
      const variantSuffix = input.variantLabel ? `, variante "${input.variantLabel}"` : "";
      throw new VersionConflictError(
        `Conflicto de versión: Page (${input.offerId}, ${input.kind}${variantSuffix}) ya no está en version=${input.expectedVersion} — otra escritura la modificó primero.`
      );
    }
    return row;
  }
}
