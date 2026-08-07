import type { PageRepository, UpsertPageInput } from "../../../application";
import type { Page, PageKind, PageStatus } from "../../../domain";
import { prisma } from "../client";
import type { Prisma } from "@prisma/client";

export class PrismaPageRepository implements PageRepository {
  async findByOfferAndKind(offerId: string, kind: PageKind): Promise<Page | null> {
    return prisma.page.findUnique({ where: { offerId_kind: { offerId, kind } } });
  }

  async findPublishedBySlug(slug: string): Promise<Page | null> {
    return prisma.page.findFirst({ where: { slug, kind: "LANDING", status: "PUBLISHED" } });
  }

  async upsert(input: UpsertPageInput): Promise<Page> {
    return prisma.page.upsert({
      where: { offerId_kind: { offerId: input.offerId, kind: input.kind } },
      create: {
        offerId: input.offerId,
        kind: input.kind,
        slug: input.slug ?? null,
        content: input.content as Prisma.InputJsonValue,
      },
      update: {
        slug: input.slug ?? null,
        content: input.content as Prisma.InputJsonValue,
      },
    });
  }

  async setStatus(pageId: string, status: PageStatus): Promise<void> {
    await prisma.page.update({ where: { id: pageId }, data: { status } });
  }
}
