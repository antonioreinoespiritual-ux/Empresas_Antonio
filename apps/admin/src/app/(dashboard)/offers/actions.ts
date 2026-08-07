"use server";

import { revalidatePath } from "next/cache";
import type { CreateOfferInput, CreatePriceInput, UpdateOfferInput } from "@repo/core/application";
import { commerce } from "@/lib/commerce";

export async function createOfferAction(input: CreateOfferInput) {
  await commerce.offers.create(input);
  revalidatePath("/offers");
}

export async function updateOfferAction(offerId: string, input: UpdateOfferInput) {
  await commerce.offers.update(offerId, input);
  revalidatePath("/offers");
  revalidatePath(`/offers/${offerId}/edit`);
}

export async function setOfferActiveAction(offerId: string, isActive: boolean) {
  await commerce.offers.setActive(offerId, isActive);
  revalidatePath("/offers");
}

export async function addPriceAction(offerId: string, price: CreatePriceInput) {
  await commerce.offers.addPrice(offerId, price);
  revalidatePath(`/offers/${offerId}/edit`);
}

export async function removePriceAction(
  offerId: string,
  priceId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await commerce.offers.removePrice(priceId);
    revalidatePath(`/offers/${offerId}/edit`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se puede quitar un precio ya usado en pedidos existentes" };
  }
}
