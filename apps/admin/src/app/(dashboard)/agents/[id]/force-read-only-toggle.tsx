"use client";

import { useState } from "react";
import { Checkbox, useToast } from "@repo/admin-ui/primitives";
import { setForceReadOnlyAction } from "../actions";

export function ForceReadOnlyToggle({ clientId, forceReadOnly }: { clientId: string; forceReadOnly: boolean }) {
  const [isPending, setPending] = useState(false);
  const { show } = useToast();

  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <Checkbox
        checked={forceReadOnly}
        disabled={isPending}
        onChange={async (e) => {
          setPending(true);
          const result = await setForceReadOnlyAction(clientId, e.target.checked);
          setPending(false);
          show(result.ok ? "Actualizado" : result.error ?? "No se pudo actualizar", result.ok ? undefined : "danger");
        }}
      />
      Bloquear toda escritura (forceReadOnly) — sin importar los scopes de sus keys
    </label>
  );
}
