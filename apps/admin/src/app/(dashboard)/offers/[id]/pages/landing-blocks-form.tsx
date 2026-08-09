"use client";

import { useState, type FormEvent } from "react";
import type { LandingBlock, LandingBlockType, Page } from "@repo/core/domain";
import { Button, Card, Field, Input, Select, useToast } from "@repo/admin-ui/primitives";
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
  const { show } = useToast();
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
    if (!result.ok) {
      setError(result.error ?? "No se pudo guardar");
      return;
    }
    show("Bloques guardados");
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-ink">Página de ventas — editor de bloques</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Arma la landing eligiendo, ordenando y editando bloques. Reemplaza a &quot;Página de ventas (landing)&quot; de
        arriba cuando se guarda acá: ambas escriben al mismo Page, gana la que se guardó al último.
      </p>

      <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
        <Field label="Slug (URL)">
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </Field>

        <div className="flex flex-col gap-3">
          {blocks.length === 0 && (
            <p className="rounded-md border border-dashed border-border p-3 text-sm text-ink-muted">
              Todavía no hay bloques — agrega el primero abajo.
            </p>
          )}
          {blocks.map((block, index) => (
            <div key={index} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">
                  {index + 1}. {BLOCK_TYPE_LABELS[block.type]}
                </span>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => moveBlock(index, -1)} disabled={index === 0} aria-label="Subir bloque">
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => moveBlock(index, 1)}
                    disabled={index === blocks.length - 1}
                    aria-label="Bajar bloque"
                  >
                    ↓
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => removeBlock(index)}>
                    Eliminar
                  </Button>
                </div>
              </div>
              <div className="mt-3 border-t border-border pt-3">
                <BlockFields block={block} onChange={(next) => updateBlock(index, next)} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Select className="w-auto" value={addType} onChange={(e) => setAddType(e.target.value as LandingBlockType)}>
            {BLOCK_TYPES.map((type) => (
              <option key={type} value={type}>
                {BLOCK_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
          <Button type="button" variant="secondary" size="sm" onClick={addBlock}>
            + Agregar bloque
          </Button>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={isSubmitting} className="self-start">
          Guardar bloques
        </Button>
      </form>
    </Card>
  );
}
