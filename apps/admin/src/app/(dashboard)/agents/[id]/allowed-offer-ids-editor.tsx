"use client";

import { useState } from "react";
import { Button, Checkbox, useToast } from "@repo/admin-ui/primitives";
import { setAllowedOfferIdsAction } from "../actions";

type OfferScope = "all" | "none" | "selected";

function initialScope(allowedOfferIds: string[] | null): OfferScope {
  if (allowedOfferIds === null) return "all";
  return allowedOfferIds.length === 0 ? "none" : "selected";
}

export function AllowedOfferIdsEditor({
  clientId,
  allowedOfferIds,
  offers,
}: {
  clientId: string;
  allowedOfferIds: string[] | null;
  offers: { id: string; name: string }[];
}) {
  const { show } = useToast();
  const [offerScope, setOfferScope] = useState<OfferScope>(initialScope(allowedOfferIds));
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>(allowedOfferIds ?? []);
  const [isSaving, setSaving] = useState(false);

  async function onSave() {
    setSaving(true);
    const next = offerScope === "all" ? null : offerScope === "none" ? [] : selectedOfferIds;
    const result = await setAllowedOfferIdsAction(clientId, next);
    setSaving(false);
    show(result.ok ? "Alcance actualizado" : result.error ?? "No se pudo actualizar", result.ok ? undefined : "danger");
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="radio" name={`offerScope-${clientId}`} checked={offerScope === "all"} onChange={() => setOfferScope("all")} />
        Todas las Offers (actuales y futuras)
      </label>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="radio" name={`offerScope-${clientId}`} checked={offerScope === "none"} onChange={() => setOfferScope("none")} />
        Ninguna Offer
      </label>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="radio" name={`offerScope-${clientId}`} checked={offerScope === "selected"} onChange={() => setOfferScope("selected")} />
        Offers específicas
      </label>
      {offerScope === "selected" && (
        <div className="ml-6 mt-2 max-h-48 space-y-1 overflow-y-auto rounded border border-border p-2">
          {offers.map((offer) => (
            <label key={offer.id} className="flex items-center gap-2 text-sm text-ink">
              <Checkbox
                checked={selectedOfferIds.includes(offer.id)}
                onChange={(e) =>
                  setSelectedOfferIds((prev) => (e.target.checked ? [...prev, offer.id] : prev.filter((id) => id !== offer.id)))
                }
              />
              {offer.name}
            </label>
          ))}
        </div>
      )}
      <Button type="button" size="sm" onClick={onSave} disabled={isSaving}>
        {isSaving ? "Guardando..." : "Guardar alcance"}
      </Button>
    </div>
  );
}
