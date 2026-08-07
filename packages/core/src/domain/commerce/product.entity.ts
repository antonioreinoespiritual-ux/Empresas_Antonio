export type ProductType = "DIGITAL" | "PHYSICAL" | "SERVICE" | "SUBSCRIPTION";
export type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  status: ProductStatus;
}
