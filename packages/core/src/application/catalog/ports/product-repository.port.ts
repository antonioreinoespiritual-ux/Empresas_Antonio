import type { Product, ProductStatus, ProductType } from "../../../domain";
import type { CursorPaginationInput, PaginatedResult } from "../../shared/paginated-result";

export interface CreateProductInput {
  name: string;
  type: ProductType;
}

export interface UpdateProductInput {
  name?: string;
  type?: ProductType;
}

export interface ListProductsForAgentInput extends CursorPaginationInput {
  /** null = sin restricción; array = solo Products con al menos una Offer en este set (F3 retrofit, PLAN-AGENT-API-01). */
  allowedOfferIds: string[] | null;
}

export interface ProductRepository {
  findById(productId: string): Promise<Product | null>;
  list(): Promise<Product[]>;
  create(input: CreateProductInput): Promise<Product>;
  update(productId: string, input: UpdateProductInput): Promise<Product>;
  setStatus(productId: string, status: ProductStatus): Promise<void>;
  /** Variante para apps/agent-api: paginada y acotada por allowedOfferIds — list() sigue sin cambios para apps/admin. */
  listForAgent(input: ListProductsForAgentInput): Promise<PaginatedResult<Product>>;
  /** Igual que findById, pero null también si el Product no tiene ninguna Offer dentro de allowedOfferIds. */
  findByIdForAgent(productId: string, allowedOfferIds: string[] | null): Promise<Product | null>;
}
