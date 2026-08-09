"use client";

import { useState, type FormEvent } from "react";
import type { LandingBlock, LandingBlockType, Page } from "@repo/core/domain";
import { savePageAction } from "./actions";
import { BlockFields } from "./block-fields";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

const BLOCK_TYPES: LandingBlockType[] = [
  "hero",
  "vsl",
  "benefits",
  "testimonials",
  "faq",
  "guarantee",
  "cta",
  "richText",
];

const BLOCK_TYPE_LABELS: Record<LandingBlockType, string> = {
  hero: "Hero (portada)",
  vsl: "Video (VSL)",
  benefits: "Beneficios",
  testimonials: "Testimonios",
  faq: "Preguntas frecuentes",
  guarantee: "Garantía",
  cta: "Llamado a la acción (CTA)",
  richText: "Texto libre (HTML)",
};

function defaultBlockFor(type: LandingBlockType): LandingBlock {
  switch (type) {
    case "hero":
      return { type: "hero", title: "Título de tu oferta", subtitle: "Subtítulo breve", ctaLabel: "Comprar ahora" };
    case "vsl":
      return { type: "vsl", embedUrl: "https://", autoplay: false };
    case "benefits":
      return { type: "benefits", heading: "Qué incluye", items: [{ title: "Beneficio 1", description: "" }] };
    case "testimonials":
      return {
        type: "testimonials",
        heading: "Lo que dicen nuestros clientes",
        items: [{ quote: "", authorName: "" }],
      };
    case "faq":
      return { type: "faq", heading: "Preguntas frecuentes", items: [{ question: "", answer: "" }] };
    case "guarantee":
      return { type: "guarantee", title: "Garantía", description: "" };
    case "cta":
      return { type: "cta", headline: "¿Listo para empezar?", buttonLabel: "Comprar ahora" };
    case "richText":
      return { type: "richText", html: "" };
    default: {
      const exhaustive: never = type;
      throw new Error(`Tipo de bloque desconocido: ${exhaustive}`);
    }
  }
}

function readBlocks(content: unknown): LandingBlock[] {
  if (content && typeof content === "object" && Array.isArray((content as Record<string, unknown>).blocks)) {
    return (content as { blocks: LandingBlock[] }).blocks;
  }
  return [];
}

/**
 * Editor visual real de la landing: arma la página eligiendo, ordenando y
 * editando bloques con formularios propios de cada tipo — no HTML libre,
 * salvo "Texto libre" (richText), la única excepción ya documentada en el
 * dominio. Guarda con el mismo savePageAction/parsePageContent que ya usaba
 * el modo JSON — cero cambios de validación o backend.
 */
export function LandingBlocksForm({ offerId, page }: { offerId: string; page: Page | null }) {
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [blocks, setBlocks] = useState<LandingBlock[]>(() => readBlocks(page?.content ?? null));
  const [addType, setAddType] = useState<LandingBlockType>("hero");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateBlock(index: number, next: LandingBlock) {
    setBlocks((prev) => prev.map((block, i) => (i === index ? next : block)));
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const moved = next[index]!;
      next[index] = next[target]!;
      next[target] = moved;
      return next;
    });
  }

  function addBlock() {
    setBlocks((prev) => [...prev, defaultBlockFor(addType)]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // Mismo motivo que en el resto de forms de Páginas: sin esto, un slug
    // vacío o inválido se guarda igual y la página publicada queda sin
    // ninguna URL en /[slug] que pueda resolverla.
    if (!SLUG_PATTERN.test(slug)) {
      setError("El slug es obligatorio: solo minúsculas, números y guiones.");
      return;
    }
    if (blocks.length === 0) {
      setError("Agrega al menos un bloque antes de guardar.");
      return;
    }
    setIsSubmitting(true);
    const result = await savePageAction({ offerId, kind: "LANDING", slug, content: { blocks } });
    setIsSubmitting(false);
    if (!result.ok) setError(result.error ?? "No se pudo guardar");
  }

  return (
    <section className="rounded border p-4">
      <h2 className="text-lg font-medium">Página de ventas — editor de bloques</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Arma la landing eligiendo, ordenando y editando bloques. Reemplaza a &quot;Página de ventas (landing)&quot; de
        arriba cuando se guarda acá: ambas escriben al mismo Page, gana la que se guardó al último.
      </p>

      <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
        <div>
          <label className="block text-sm font-medium">Slug (URL)</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-3">
          {blocks.length === 0 && (
            <p className="rounded border border-dashed p-3 text-sm text-neutral-500">
              Todavía no hay bloques — agrega el primero abajo.
            </p>
          )}
          {blocks.map((block, index) => (
            <div key={index} className="rounded border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {index + 1}. {BLOCK_TYPE_LABELS[block.type]}
                </span>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => moveBlock(index, -1)}
                    disabled={index === 0}
                    aria-label="Subir bloque"
                    className="rounded border px-2 py-1 text-xs disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(index, 1)}
                    disabled={index === blocks.length - 1}
                    aria-label="Bajar bloque"
                    className="rounded border px-2 py-1 text-xs disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBlock(index)}
                    className="rounded border border-red-300 px-2 py-1 text-xs text-red-600"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
              <div className="mt-3 border-t pt-3">
                <BlockFields block={block} onChange={(next) => updateBlock(index, next)} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <select
            className="rounded border px-2 py-1.5 text-sm"
            value={addType}
            onChange={(e) => setAddType(e.target.value as LandingBlockType)}
          >
            {BLOCK_TYPES.map((type) => (
              <option key={type} value={type}>
                {BLOCK_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <button type="button" onClick={addBlock} className="rounded border px-3 py-1.5 text-sm">
            + Agregar bloque
          </button>
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
