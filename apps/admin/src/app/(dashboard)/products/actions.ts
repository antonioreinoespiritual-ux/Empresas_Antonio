"use server";

import { revalidatePath } from "next/cache";
import type { ProductStatus, ProductType } from "@repo/core/domain";
import { commerce } from "@/lib/commerce";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function createProductAction(input: { name: string; type: ProductType }) {
  await requireAdminSession();
  await commerce.products.create(input);
  revalidatePath("/products");
}

export async function updateProductAction(productId: string, input: { name: string; type: ProductType }) {
  await requireAdminSession();
  await commerce.products.update(productId, input);
  revalidatePath("/products");
}

export async function setProductStatusAction(productId: string, status: ProductStatus) {
  await requireAdminSession();
  await commerce.products.setStatus(productId, status);
  revalidatePath("/products");
}
