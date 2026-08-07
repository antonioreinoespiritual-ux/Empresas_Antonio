export type ProductType = "DIGITAL" | "PHYSICAL" | "SERVICE" | "SUBSCRIPTION";

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  status: "ACTIVE" | "INACTIVE";
}
