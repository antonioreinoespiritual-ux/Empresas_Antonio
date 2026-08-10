"use client";

import { useState } from "react";
import { ConfirmDialog, StatusPill, useToast } from "@repo/admin-ui/primitives";
import { setApiClientStatusAction } from "../actions";

/**
 * Suspender es el kill switch por cliente (F1) — corta el acceso de todas
 * sus keys sin revocarlas una por una. ConfirmDialog porque es una acción
 * real de corte de acceso (F6, PLAN-AGENT-API-01), no un toggle cosmético.
 */
export function ClientStatusToggle({ clientId, status }: { clientId: string; status: "ACTIVE" | "SUSPENDED" }) {
  const [confirming, setConfirming] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const { show } = useToast();
  const isActive = status === "ACTIVE";

  async function onConfirm() {
    setLoading(true);
    const result = await setApiClientStatusAction(clientId, isActive ? "SUSPENDED" : "ACTIVE");
    setLoading(false);
    setConfirming(false);
    show(result.ok ? (isActive ? "Cliente suspendido" : "Cliente reactivado") : result.error ?? "No se pudo cambiar el estado", result.ok ? undefined : "danger");
  }

  return (
    <>
      <button type="button" onClick={() => setConfirming(true)}>
        <StatusPill tone={isActive ? "success" : "danger"}>{isActive ? "Activo" : "Suspendido"}</StatusPill>
      </button>
      <ConfirmDialog
        open={confirming}
        title={isActive ? "¿Suspender este agente?" : "¿Reactivar este agente?"}
        description={
          isActive
            ? "Corta el acceso de TODAS sus ApiKey de inmediato, sin revocarlas una por una. Puede reactivarse después."
            : "Sus ApiKey vuelven a poder autenticarse, según su propio estado individual (revocada/vencida)."
        }
        confirmLabel={isActive ? "Suspender" : "Reactivar"}
        tone={isActive ? "danger" : "primary"}
        isLoading={isLoading}
        onConfirm={onConfirm}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
