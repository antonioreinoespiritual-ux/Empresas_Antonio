"use server";

import { revalidatePath } from "next/cache";
import type { CreateOfferInput, CreatePriceInput, UpdateOfferInput } from "@repo/core/application";
import { commerce } from "@/lib/commerce";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function createOfferAction(input: CreateOfferInput): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSession();
  try {
    await commerce.offers.create(input);
    revalidatePath("/offers");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo crear la oferta" };
  }
}

export async function updateOfferAction(
  offerId: string,
  input: UpdateOfferInput
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSession();
  try {
    await commerce.offers.update(offerId, input);
    revalidatePath("/offers");
    revalidatePath(`/offers/${offerId}/edit`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo actualizar la oferta" };
  }
}

export async function setOfferActiveAction(
  offerId: string,
  isActive: boolean
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSession();
  try {
    await commerce.offers.setActive(offerId, isActive);
    revalidatePath("/offers");
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo cambiar el estado de la oferta" };
  }
}

export async function addPriceAction(
  offerId: string,
  price: CreatePriceInput
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSession();
  try {
    await commerce.offers.addPrice(offerId, price);
    revalidatePath(`/offers/${offerId}/edit`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo agregar el precio" };
  }
}

export async function removePriceAction(
  offerId: string,
  priceId: string
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSession();
  try {
    await commerce.offers.removePrice(priceId);
    revalidatePath(`/offers/${offerId}/edit`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se puede quitar un precio ya usado en pedidos existentes" };
  }
}
