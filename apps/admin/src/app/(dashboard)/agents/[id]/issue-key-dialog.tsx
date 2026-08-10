"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button, Card, Checkbox, useToast } from "@repo/admin-ui/primitives";
import { issueApiKeyAction, rotateApiKeyAction } from "../actions";

const AVAILABLE_SCOPES = [
  { value: "read", label: "read — leer catálogo (Products, Offers, Pages)" },
  { value: "write", label: "write — crear/editar Pages y bloques" },
  { value: "publish:pages", label: "publish:pages — publicar/despublicar y emitir preview" },
];

interface IssueKeyDialogProps {
  clientId: string;
  /** Presente = esto es una rotación (revoca esta key al emitir la nueva); ausente = emisión nueva. */
  rotatingKeyId?: string;
  initialScopes?: string[];
  onClose: () => void;
}

/**
 * El secreto se muestra una única vez — no se puede recuperar después
 * (F6, PLAN-AGENT-API-01: "gate de confirmación de 'ya lo copié' antes de
 * poder cerrar el modal"). A diferencia de ConfirmDialog, este modal NO se
 * cierra con Escape/clic afuera mientras el secreto está visible y sin
 * confirmar — cerrarlo sin querer sería perder la única oportunidad de
 * copiarlo.
 */
export function IssueKeyDialog({ clientId, rotatingKeyId, initialScopes, onClose }: IssueKeyDialogProps) {
  const { show } = useToast();
  const [scopes, setScopes] = useState<string[]>(initialScopes ?? []);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plaintextKey, setPlaintextKey] = useState<string | null>(null);
  const [confirmedCopied, setConfirmedCopied] = useState(false);

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    const result = rotatingKeyId
      ? await rotateApiKeyAction(clientId, rotatingKeyId, scopes)
      : await issueApiKeyAction(clientId, scopes);
    setSubmitting(false);
    if (result.ok && result.plaintextKey) {
      setPlaintextKey(result.plaintextKey);
      show(rotatingKeyId ? "Key rotada" : "Key emitida");
    } else {
      setError(result.error ?? "No se pudo completar la operación");
    }
  }

  function handleBackdropClick() {
    // Antes de emitir, o ya confirmado el copiado: cerrar es seguro.
    if (!plaintextKey || confirmedCopied) onClose();
  }

  // Portal a document.body: se monta desde ApiKeyRow, dentro de <tbody>/<tr>
  // — sin portal el overlay quedaría como hijo directo de <tbody>, HTML
  // inválido (ver el mismo fix en ConfirmDialog).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={handleBackdropClick}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <Card>
          {!plaintextKey ? (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-ink">{rotatingKeyId ? "Rotar key" : "Emitir nueva key"}</h2>
              <div className="space-y-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <label key={scope.value} className="flex items-start gap-2 text-sm text-ink">
                    <Checkbox
                      checked={scopes.includes(scope.value)}
                      onChange={(e) =>
                        setScopes((prev) => (e.target.checked ? [...prev, scope.value] : prev.filter((s) => s !== scope.value)))
                      }
                    />
                    {scope.label}
                  </label>
                ))}
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="button" size="sm" onClick={onSubmit} disabled={isSubmitting}>
                  {isSubmitting ? "Emitiendo..." : rotatingKeyId ? "Rotar" : "Emitir"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-ink">Secreto generado</h2>
              <p className="text-sm text-danger">
                Guardalo ahora — no se puede recuperar después. Si lo perdés, hay que revocar esta key y emitir otra.
              </p>
              <code className="block break-all rounded bg-surface-sunken p-3 text-xs">{plaintextKey}</code>
              <label className="flex items-center gap-2 text-sm text-ink">
                <Checkbox checked={confirmedCopied} onChange={(e) => setConfirmedCopied(e.target.checked)} />
                Ya copié el secreto
              </label>
              <div className="flex justify-end">
                <Button type="button" size="sm" disabled={!confirmedCopied} onClick={onClose}>
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>,
    document.body,
  );
}
