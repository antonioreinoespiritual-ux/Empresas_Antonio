"use client";

import { useState } from "react";
import { Button, ConfirmDialog, StatusPill, TableCell, TableRow, useToast } from "@repo/admin-ui/primitives";
import { revokeApiKeyAction } from "../actions";
import { IssueKeyDialog } from "./issue-key-dialog";

interface ApiKeyRowProps {
  clientId: string;
  apiKey: { id: string; keyPrefix: string; scopes: string[]; revokedAt: Date | null; expiresAt: Date | null };
}

function isUsable(apiKey: ApiKeyRowProps["apiKey"], now: Date): boolean {
  if (apiKey.revokedAt !== null) return false;
  if (apiKey.expiresAt !== null && now >= apiKey.expiresAt) return false;
  return true;
}

export function ApiKeyRow({ clientId, apiKey }: ApiKeyRowProps) {
  const { show } = useToast();
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const usable = isUsable(apiKey, new Date());

  async function onRevoke() {
    setLoading(true);
    const result = await revokeApiKeyAction(clientId, apiKey.id);
    setLoading(false);
    setConfirmingRevoke(false);
    show(result.ok ? "Key revocada" : result.error ?? "No se pudo revocar", result.ok ? undefined : "danger");
  }

  return (
    <>
      <TableRow>
        <TableCell className="font-mono text-xs">{apiKey.keyPrefix}…</TableCell>
        <TableCell className="text-ink-muted">{apiKey.scopes.join(", ") || "(sin scopes)"}</TableCell>
        <TableCell>
          <StatusPill tone={usable ? "success" : "danger"}>
            {apiKey.revokedAt !== null ? "Revocada" : usable ? "Activa" : "Vencida"}
          </StatusPill>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap justify-end gap-1">
            {usable && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setRotating(true)}>
                  Rotar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingRevoke(true)}>
                  Revocar
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
      <ConfirmDialog
        open={confirmingRevoke}
        title="¿Revocar esta ApiKey?"
        description="Corta su acceso de inmediato. No se puede deshacer — para volver a usarla habría que emitir una nueva."
        confirmLabel="Revocar"
        isLoading={isLoading}
        onConfirm={onRevoke}
        onCancel={() => setConfirmingRevoke(false)}
      />
      {rotating && (
        <IssueKeyDialog clientId={clientId} rotatingKeyId={apiKey.id} initialScopes={apiKey.scopes} onClose={() => setRotating(false)} />
      )}
    </>
  );
}
