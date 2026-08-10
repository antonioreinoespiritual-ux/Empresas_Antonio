"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Checkbox, Field, Input, Textarea, useToast } from "@repo/admin-ui/primitives";
import { createApiClientAction } from "./actions";

type OfferScope = "all" | "none" | "selected";

/**
 * "Todas"/"Ninguna"/"Seleccionar" en vez de un array vacío por defecto —
 * null/[]/array son 3 estados con significado real (ver allowedOfferIds en
 * el dominio), no una casilla "vacía" que el admin podría confundir con
 * "sin elegir todavía".
 */
export function AgentClientForm({ offers }: { offers: { id: string; name: string }[] }) {
  const router = useRouter();
  const { show } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [forceReadOnly, setForceReadOnly] = useState(false);
  const [offerScope, setOfferScope] = useState<OfferScope>("all");
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("El nombre es requerido");
      return;
    }
    setError(null);
    setSubmitting(true);
    const allowedOfferIds = offerScope === "all" ? null : offerScope === "none" ? [] : selectedOfferIds;
    const result = await createApiClientAction({ name, description: description || undefined, forceReadOnly, allowedOfferIds });
    setSubmitting(false);
    if (result.ok && result.clientId) {
      show("Agente creado");
      router.push(`/agents/${result.clientId}`);
    } else {
      setError(result.error ?? "No se pudo crear el agente");
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Nombre" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Editorial Agents" />
        </Field>

        <Field label="Descripción (opcional)" htmlFor="description">
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>

        <Field label="forceReadOnly">
          <label className="flex items-center gap-2 text-sm text-ink">
            <Checkbox checked={forceReadOnly} onChange={(e) => setForceReadOnly(e.target.checked)} />
            Bloquear toda escritura para este cliente, sin importar los scopes de sus keys
          </label>
        </Field>

        <Field label="Alcance de Offers (allowedOfferIds)">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="offerScope" checked={offerScope === "all"} onChange={() => setOfferScope("all")} />
              Todas las Offers (actuales y futuras)
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="offerScope" checked={offerScope === "none"} onChange={() => setOfferScope("none")} />
              Ninguna Offer
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="offerScope" checked={offerScope === "selected"} onChange={() => setOfferScope("selected")} />
              Seleccionar Offers específicas
            </label>
            {offerScope === "selected" && (
              <div className="ml-6 mt-2 max-h-48 space-y-1 overflow-y-auto rounded border border-border p-2">
                {offers.length === 0 && <p className="text-sm text-ink-faint">No hay Offers todavía.</p>}
                {offers.map((offer) => (
                  <label key={offer.id} className="flex items-center gap-2 text-sm text-ink">
                    <Checkbox
                      checked={selectedOfferIds.includes(offer.id)}
                      onChange={(e) =>
                        setSelectedOfferIds((prev) =>
                          e.target.checked ? [...prev, offer.id] : prev.filter((id) => id !== offer.id)
                        )
                      }
                    />
                    {offer.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creando..." : "Crear agente"}
        </Button>
      </form>
    </Card>
  );
}
