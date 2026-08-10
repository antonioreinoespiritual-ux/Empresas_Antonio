import type { CreateProductInput, ListProductsForAgentInput, ProductRepository, UpdateProductInput } from "../../../application";
import type { ProductStatus } from "../../../domain";
import { prisma } from "../client";

/** undefined = sin restricción (Prisma) — traduce el `null` de dominio ("todas las Offers"). */
function offerScopeFilter(allowedOfferIds: string[] | null) {
  return allowedOfferIds === null ? undefined : { offers: { some: { id: { in: allowedOfferIds } } } };
}

export class PrismaProductRepository implements ProductRepository {
  async findById(productId: string) {
    return prisma.product.findUnique({ where: { id: productId } });
  }

  async list() {
    return prisma.product.findMany({ orderBy: { name: "asc" } });
  }

  async listForAgent(input: ListProductsForAgentInput) {
    const rows = await prisma.product.findMany({
      where: offerScopeFilter(input.allowedOfferIds),
      orderBy: { id: "asc" },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null };
  }

  async findByIdForAgent(productId: string, allowedOfferIds: string[] | null) {
    return prisma.product.findFirst({ where: { id: productId, ...offerScopeFilter(allowedOfferIds) } });
  }

  async create(input: CreateProductInput) {
    return prisma.product.create({ data: { name: input.name, type: input.type } });
  }

  async update(productId: string, input: UpdateProductInput) {
    return prisma.product.update({ where: { id: productId }, data: input });
  }

  async setStatus(productId: string, status: ProductStatus): Promise<void> {
    await prisma.product.update({ where: { id: productId }, data: { status } });
  }
}
