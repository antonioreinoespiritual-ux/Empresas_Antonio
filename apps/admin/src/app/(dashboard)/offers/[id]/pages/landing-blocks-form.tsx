"use client";

import { useState } from "react";
import type { Page } from "@repo/core/domain";
import { savePageAction } from "./actions";

const EXAMPLE = {
  blocks: [
    { type: "hero", title: "Título de tu oferta", subtitle: "Subtítulo breve", ctaLabel: "Comprar ahora" },
    { type: "benefits", heading: "Qué incluye", items: [{ title: "Beneficio 1", description: "Descripción corta" }] },
    { type: "cta", headline: "¿Listo para empezar?", buttonLabel: "Comprar ahora" },
  ],
};

/**
 * Autoría temporal de la landing en modo bloques: el editor visual (arrastrar,
 * reordenar, activar/desactivar bloques) todavía no existe — esto es lo
 * mínimo real para poder usar el sistema de bloques de Fase B3 hoy, validado
 * server-side por el mismo parsePageContent que usa el renderer público.
 * Reemplaza a "Página de ventas (landing)" de arriba cuando se guarda acá:
 * ambas escriben al mismo Page, gana la que se guardó al último.
 */
export function LandingBlocksForm({ offerId, page }: { offerId: string; page: Page | null }) {
  const hasBlocks = Boolean(page?.content && typeof page.content === "object" && "blocks" in (page.content as object));
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [json, setJson] = useState(() => JSON.stringify(hasBlocks ? page!.content : EXAMPLE, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setError("El JSON no es válido — revisa comas, comillas y llaves.");
      return;
    }
    setIsSubmitting(true);
    const result = await savePageAction({ offerId, kind: "LANDING", slug, content: parsed });
    setIsSubmitting(false);
    if (!result.ok) setError(result.error ?? "No se pudo guardar");
  }

  return (
    <section className="rounded border p-4">
      <h2 className="text-lg font-medium">Página de ventas — modo bloques (avanzado)</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Temporal hasta que exista el editor visual: pega o edita el JSON de bloques. Tipos válidos: hero, vsl,
        benefits, testimonials, faq, guarantee, cta, richText. Se valida al guardar.
      </p>
      <form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
        <div>
          <label className="block text-sm font-medium">Slug (URL)</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Bloques (JSON)</label>
          <textarea
            className="mt-1 w-full rounded border px-3 py-2 font-mono text-xs"
            rows={16}
            value={json}
            onChange={(e) => setJson(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="self-start rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          type="submit"
          disabled={isSubmitting}
        >
          Guardar bloques
        </button>
      </form>
    </section>
  );
}
