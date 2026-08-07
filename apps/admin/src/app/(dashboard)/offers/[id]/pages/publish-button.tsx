"use client";

import { useState } from "react";
import type { PageStatus } from "@repo/core/domain";

export function PublishButton({
  status,
  onToggle,
}: {
  status: PageStatus;
  onToggle: () => Promise<unknown>;
}) {
  const [isPending, setPending] = useState(false);

  return (
    <button
      type="button"
      className="rounded border px-3 py-1 text-xs disabled:opacity-50"
      disabled={isPending}
      onClick={async () => {
        setPending(true);
        await onToggle();
        setPending(false);
      }}
    >
      {status === "PUBLISHED" ? "Publicado (despublicar)" : "Borrador (publicar)"}
    </button>
  );
}
