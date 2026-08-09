"use client";

import { useState } from "react";
import type { ProductStatus } from "@repo/core/domain";
import { StatusPill, useToast } from "@repo/admin-ui/primitives";
import { setProductStatusAction } from "./actions";

const LABEL: Record<ProductStatus, string> = {
  PUBLISHED: "Publicado",
  DRAFT: "Borrador",
  ARCHIVED: "Archivado",
};

const TONE: Record<ProductStatus, "success" | "neutral"> = {
  PUBLISHED: "success",
  DRAFT: "neutral",
  ARCHIVED: "neutral",
};

/** Mismo patrón que ActiveToggle (Ofertas): el pill de estado ES el control, y confirma el resultado con un toast. */
export function PublishToggle({ productId, status }: { productId: string; status: ProductStatus }) {
  const [isPending, setPending] = useState(false);
  const { show } = useToast();
  const nextStatus: ProductStatus = status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={async () => {
        setPending(true);
        const result = await setProductStatusAction(productId, nextStatus);
        setPending(false);
        if (result.ok) {
          show(nextStatus === "PUBLISHED" ? "Producto publicado" : "Producto pasado a borrador");
        } else {
          show(result.error ?? "No se pudo cambiar el estado", "danger");
        }
      }}
      className="disabled:opacity-50"
    >
      <StatusPill tone={TONE[status]}>{LABEL[status]}</StatusPill>
    </button>
  );
}
