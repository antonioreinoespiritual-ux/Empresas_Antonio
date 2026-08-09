"use client";

import { useState } from "react";
import type { PageStatus } from "@repo/core/domain";
import { StatusPill, useToast } from "@repo/admin-ui/primitives";

/** Mismo patrón que ActiveToggle/PublishToggle: el pill de estado ES el control, y confirma el resultado con un toast. */
export function PublishButton({
  status,
  onToggle,
}: {
  status: PageStatus;
  onToggle: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [isPending, setPending] = useState(false);
  const { show } = useToast();
  const willPublish = status !== "PUBLISHED";

  return (
    <button
      type="button"
      disabled={isPending}
      className="disabled:opacity-50"
      onClick={async () => {
        setPending(true);
        const result = await onToggle();
        setPending(false);
        if (result.ok) {
          show(willPublish ? "Página publicada" : "Página pasada a borrador");
        } else {
          show(result.error ?? "No se pudo cambiar el estado", "danger");
        }
      }}
    >
      <StatusPill tone={status === "PUBLISHED" ? "success" : "neutral"}>
        {status === "PUBLISHED" ? "Publicado" : "Borrador"}
      </StatusPill>
    </button>
  );
}
