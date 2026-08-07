"use client";

import { useState } from "react";
import type { ProductStatus } from "@repo/core/domain";
import { setProductStatusAction } from "./actions";

export function PublishToggle({ productId, status }: { productId: string; status: ProductStatus }) {
  const [isPending, setPending] = useState(false);
  const nextStatus: ProductStatus = status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";

  return (
    <button
      type="button"
      className="rounded border px-2 py-1 text-xs disabled:opacity-50"
      disabled={isPending}
      onClick={async () => {
        setPending(true);
        await setProductStatusAction(productId, nextStatus);
        setPending(false);
      }}
    >
      {status === "PUBLISHED" ? "Publicado" : status === "ARCHIVED" ? "Archivado" : "Borrador"}
    </button>
  );
}
