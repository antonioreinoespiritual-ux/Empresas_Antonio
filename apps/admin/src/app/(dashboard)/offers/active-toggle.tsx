"use client";

import { useState } from "react";
import { StatusPill, useToast } from "@repo/admin-ui/primitives";
import { setOfferActiveAction } from "./actions";

/**
 * El estado ES la acción: un pill clicable, no un botón separado al lado de
 * un texto de estado — evita duplicar la misma información dos veces en la
 * fila. Confirma el resultado con un toast: sin esto, activar/desactivar no
 * daba ninguna señal de que el clic surtió efecto.
 */
export function ActiveToggle({ offerId, isActive }: { offerId: string; isActive: boolean }) {
  const [isPending, setPending] = useState(false);
  const { show } = useToast();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={async () => {
        setPending(true);
        const result = await setOfferActiveAction(offerId, !isActive);
        setPending(false);
        if (result.ok) {
          show(!isActive ? "Oferta activada" : "Oferta desactivada");
        } else {
          show(result.error ?? "No se pudo cambiar el estado", "danger");
        }
      }}
      className="disabled:opacity-50"
    >
      <StatusPill tone={isActive ? "success" : "neutral"}>{isActive ? "Activa" : "Inactiva"}</StatusPill>
    </button>
  );
}
