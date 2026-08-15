import type { AssetRepository, CreateAssetInput } from "../../../application";
import { prisma } from "../client";

export class PrismaAssetRepository implements AssetRepository {
  async create(input: CreateAssetInput) {
    return prisma.asset.create({ data: input });
  }

  async findById(assetId: string) {
    return prisma.asset.findUnique({ where: { id: assetId } });
  }

  async findByIds(assetIds: string[]) {
    if (assetIds.length === 0) return [];
    return prisma.asset.findMany({ where: { id: { in: assetIds } } });
  }

  async list(input: { cursor?: string; limit: number }) {
    const rows = await prisma.asset.findMany({
      orderBy: { id: "asc" },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }
}
