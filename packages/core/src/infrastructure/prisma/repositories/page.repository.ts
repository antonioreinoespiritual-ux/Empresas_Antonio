import { ConflictError, VersionConflictError } from "../../../domain";
import type { Page, PageKind, PageStatus } from "../../../domain";
import type {
  AgentPageAuditContext,
  CreatePageInput,
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
};

const RETURNING_COLUMNS = `"id","offerId","kind","slug","status","content","version","updatedAt"`;

export class PrismaPageRepository implements PageRepository {
  async findByOfferAndKind(offerId: string, kind: PageKind): Promise<Page | null> {
    return prisma.page.findUnique({ where: { offerId_kind: { offerId, kind } } });
  }

  async findPublishedBySlug(slug: string): Promise<Page | null> {
    return prisma.page.findFirst({ where: { slug, kind: "LANDING", status: "PUBLISHED" } });
  }

  async createInitial(input: CreatePageInput): Promise<Page> {
    try {
      return await prisma.page.create({
        data: {
          offerId: input.offerId,
          kind: input.kind,
          slug: input.slug ?? null,
          content: input.content as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictError(`Ya existe una Page ${input.kind} para la Offer ${input.offerId}`);
      }
      throw error;
    }
  }

  async updateWithVersion(input: UpdatePageWithVersionInput): Promise<Page> {
    const rows = await prisma.$queryRawUnsafe<PageRow[]>(
      `UPDATE "pages"
       SET "content" = $1::jsonb, "slug" = $2, "version" = "version" + 1, "updatedAt" = now()
       WHERE "offerId" = $3 AND "kind" = $4::"PageKind" AND "version" = $5
       RETURNING ${RETURNING_COLUMNS}`,
      JSON.stringify(input.content),
      input.slug ?? null,
      input.offerId,
      input.kind,
      input.expectedVersion
    );
    return this.requireCasRow(rows, input);
  }

  async updateWithVersionAudited(input: UpdatePageWithVersionInput, audit: AgentPageAuditContext): Promise<Page> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<PageRow[]>(
        `UPDATE "pages"
         SET "content" = $1::jsonb, "slug" = $2, "version" = "version" + 1, "updatedAt" = now()
         WHERE "offerId" = $3 AND "kind" = $4::"PageKind" AND "version" = $5
         RETURNING ${RETURNING_COLUMNS}`,
        JSON.stringify(input.content),
        input.slug ?? null,
        input.offerId,
        input.kind,
        input.expectedVersion
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
      throw new VersionConflictError(
        `Conflicto de versión: Page (${input.offerId}, ${input.kind}) ya no está en version=${input.expectedVersion} — otra escritura la modificó primero.`
      );
    }
    return row;
  }
}
