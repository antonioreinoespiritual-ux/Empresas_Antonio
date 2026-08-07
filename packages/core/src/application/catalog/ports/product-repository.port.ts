import type { Product, ProductStatus, ProductType } from "../../../domain";

export interface CreateProductInput {
  name: string;
  type: ProductType;
}

export interface UpdateProductInput {
  name?: string;
  type?: ProductType;
}

export interface ProductRepository {
  findById(productId: string): Promise<Product | null>;
  list(): Promise<Product[]>;
  create(input: CreateProductInput): Promise<Product>;
  update(productId: string, input: UpdateProductInput): Promise<Product>;
  setStatus(productId: string, status: ProductStatus): Promise<void>;
}
