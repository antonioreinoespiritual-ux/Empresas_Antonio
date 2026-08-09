"use server";

import { revalidatePath } from "next/cache";
import type { ProductStatus, ProductType } from "@repo/core/domain";
import { commerce } from "@/lib/commerce";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function createProductAction(
  input: { name: string; type: ProductType }
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSession();
  try {
    await commerce.products.create(input);
    revalidatePath("/products");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo crear el producto" };
  }
}

export async function updateProductAction(
  productId: string,
  input: { name: string; type: ProductType }
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSession();
  try {
    await commerce.products.update(productId, input);
    revalidatePath("/products");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar el producto" };
  }
}

export async function setProductStatusAction(
  productId: string,
  status: ProductStatus
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSession();
  try {
    await commerce.products.setStatus(productId, status);
    revalidatePath("/products");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo cambiar el estado del producto" };
  }
}
