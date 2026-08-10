"use server";

import { revalidatePath } from "next/cache";
import { savePageContent } from "@repo/core/application";
import { VersionConflictError } from "@repo/core/domain";
import type { PageKind, PageStatus } from "@repo/core/domain";
import { commerce } from "@/lib/commerce";
import { requireAdminSession } from "@/lib/require-admin-session";

export async function savePageAction(input: {
  offerId: string;
  kind: PageKind;
  slug?: string | null;
  content: unknown;
  /** undefined = primer guardado (la Page todavía no existe). */
  expectedVersion?: number;
}): Promise<{ ok: boolean; error?: string; conflict?: boolean }> {
  await requireAdminSession();
  try {
    await savePageContent(commerce, input);
    revalidatePath(`/offers/${input.offerId}/pages`);
    return { ok: true };
  } catch (error) {
    if (error instanceof VersionConflictError) {
      // Otro proceso (otra pestaña, otro admin, un agente) ya escribió esta
      // Page desde que se cargó el formulario — nunca se pisa a ciegas.
      revalidatePath(`/offers/${input.offerId}/pages`);
      return { ok: false, conflict: true, error: "Esta página fue modificada por otro proceso. Recargá para ver los cambios antes de volver a guardar." };
    }
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo guardar" };
  }
}

export async function setPageStatusAction(
  offerId: string,
  pageId: string,
  status: PageStatus
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSession();
  try {
    await commerce.pages.setStatus(pageId, status);
    revalidatePath(`/offers/${offerId}/pages`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo cambiar el estado de la página" };
  }
}
