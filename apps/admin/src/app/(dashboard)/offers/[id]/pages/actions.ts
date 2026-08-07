"use server";

import { revalidatePath } from "next/cache";
import { upsertPageContent } from "@repo/core/application";
import type { PageKind, PageStatus } from "@repo/core/domain";
import { commerce } from "@/lib/commerce";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function savePageAction(input: {
  offerId: string;
  kind: PageKind;
  slug?: string | null;
  content: unknown;
}): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSession();
  try {
    await upsertPageContent(commerce, input);
    revalidatePath(`/offers/${input.offerId}/pages`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo guardar" };
  }
}

export async function setPageStatusAction(offerId: string, pageId: string, status: PageStatus) {
  await requireAdminSession();
  await commerce.pages.setStatus(pageId, status);
  revalidatePath(`/offers/${offerId}/pages`);
}
