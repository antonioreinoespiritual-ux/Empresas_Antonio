import type { CreateProductInput, ProductRepository, UpdateProductInput } from "../../../application";
import type { ProductStatus } from "../../../domain";
import { prisma } from "../client";

export class PrismaProductRepository implements ProductRepository {
  async findById(productId: string) {
    return prisma.product.findUnique({ where: { id: productId } });
  }

  async list() {
    return prisma.product.findMany({ orderBy: { name: "asc" } });
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
