"use client";

import type { ReactNode } from "react";
import type { LandingBlock } from "@repo/core/domain";

type BenefitItem = Extract<LandingBlock, { type: "benefits" }>["items"][number];
type TestimonialItem = Extract<LandingBlock, { type: "testimonials" }>["items"][number];
type FaqItem = Extract<LandingBlock, { type: "faq" }>["items"][number];

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600">{label}</label>
      <input
        className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600">{label}</label>
      <textarea
        className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/**
 * Lista repetible de sub-elementos (items de benefits/testimonials/faq).
 * Cada bloque exige items.min(1) en el schema del dominio — por eso "Quitar"
 * se deshabilita en el último elemento, en vez de dejar guardar un array
 * vacío que el server rechazaría de todas formas.
 */
function ItemsEditor<T>({
  heading,
  onHeadingChange,
  items,
  onItemsChange,
  newItem,
  renderItem,
}: {
  heading?: string;
  onHeadingChange: (value: string) => void;
  items: T[];
  onItemsChange: (items: T[]) => void;
  newItem: () => T;
  renderItem: (item: T, update: (next: T) => void) => ReactNode;
}) {
  function updateItem(index: number, next: T) {
    onItemsChange(items.map((item, i) => (i === index ? next : item)));
  }
  function removeItem(index: number) {
    onItemsChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      <TextInput label="Encabezado (opcional)" value={heading ?? ""} onChange={onHeadingChange} />
      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <div key={index} className="rounded border border-dashed p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500">Elemento {index + 1}</span>
              <button
                type="button"
                onClick={() => removeItem(index)}
                disabled={items.length <= 1}
                className="text-xs text-red-600 disabled:opacity-30"
              >
                Quitar
              </button>
            </div>
            <div className="mt-1.5 flex flex-col gap-2">{renderItem(item, (next) => updateItem(index, next))}</div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onItemsChange([...items, newItem()])}
        className="self-start rounded border px-2 py-1 text-xs"
      >
        + Agregar elemento
      </button>
    </div>
  );
}

/** Formulario específico según el tipo de bloque — un caso por cada miembro de LandingBlock, sin HTML libre salvo richText. */
export function BlockFields({ block, onChange }: { block: LandingBlock; onChange: (next: LandingBlock) => void }) {
  switch (block.type) {
    case "hero":
      return (
        <div className="flex flex-col gap-2">
          <TextInput label="Título" value={block.title} onChange={(v) => onChange({ ...block, title: v })} />
          <TextInput
            label="Subtítulo (opcional)"
            value={block.subtitle ?? ""}
            onChange={(v) => onChange({ ...block, subtitle: v || undefined })}
          />
          <TextInput
            label="URL de imagen de fondo (opcional)"
            value={block.backgroundImageUrl ?? ""}
            onChange={(v) => onChange({ ...block, backgroundImageUrl: v || undefined })}
          />
          <TextInput label="Texto del botón" value={block.ctaLabel} onChange={(v) => onChange({ ...block, ctaLabel: v })} />
        </div>
      );
    case "vsl":
      return (
        <div className="flex flex-col gap-2">
          <TextInput label="URL del video (embed)" value={block.embedUrl} onChange={(v) => onChange({ ...block, embedUrl: v })} />
          <TextInput
            label="Imagen de portada (opcional)"
            value={block.posterImageUrl ?? ""}
            onChange={(v) => onChange({ ...block, posterImageUrl: v || undefined })}
          />
          <Checkbox
            label="Reproducir automáticamente"
            checked={block.autoplay}
            onChange={(v) => onChange({ ...block, autoplay: v })}
          />
        </div>
      );
    case "benefits":
      return (
        <ItemsEditor
          heading={block.heading}
          onHeadingChange={(v) => onChange({ ...block, heading: v || undefined })}
          items={block.items}
          onItemsChange={(items) => onChange({ ...block, items })}
          newItem={(): BenefitItem => ({ title: "", description: "" })}
          renderItem={(item, update) => (
            <>
              <TextInput label="Título" value={item.title} onChange={(v) => update({ ...item, title: v })} />
              <TextInput label="Descripción" value={item.description} onChange={(v) => update({ ...item, description: v })} />
            </>
          )}
        />
      );
    case "testimonials":
      return (
        <ItemsEditor
          heading={block.heading}
          onHeadingChange={(v) => onChange({ ...block, heading: v || undefined })}
          items={block.items}
          onItemsChange={(items) => onChange({ ...block, items })}
          newItem={(): TestimonialItem => ({ quote: "", authorName: "" })}
          renderItem={(item, update) => (
            <>
              <TextArea label="Testimonio" value={item.quote} onChange={(v) => update({ ...item, quote: v })} />
              <TextInput label="Nombre" value={item.authorName} onChange={(v) => update({ ...item, authorName: v })} />
              <TextInput
                label="Rol (opcional)"
                value={item.authorRole ?? ""}
                onChange={(v) => update({ ...item, authorRole: v || undefined })}
              />
            </>
          )}
        />
      );
    case "faq":
      return (
        <ItemsEditor
          heading={block.heading}
          onHeadingChange={(v) => onChange({ ...block, heading: v || undefined })}
          items={block.items}
          onItemsChange={(items) => onChange({ ...block, items })}
          newItem={(): FaqItem => ({ question: "", answer: "" })}
          renderItem={(item, update) => (
            <>
              <TextInput label="Pregunta" value={item.question} onChange={(v) => update({ ...item, question: v })} />
              <TextArea label="Respuesta" value={item.answer} onChange={(v) => update({ ...item, answer: v })} />
            </>
          )}
        />
      );
    case "guarantee":
      return (
        <div className="flex flex-col gap-2">
          <TextInput label="Título" value={block.title} onChange={(v) => onChange({ ...block, title: v })} />
          <TextArea label="Descripción" value={block.description} onChange={(v) => onChange({ ...block, description: v })} />
        </div>
      );
    case "cta":
      return (
        <div className="flex flex-col gap-2">
          <TextInput
            label="Titular (opcional)"
            value={block.headline ?? ""}
            onChange={(v) => onChange({ ...block, headline: v || undefined })}
          />
          <TextInput
            label="Subtexto (opcional)"
            value={block.subtext ?? ""}
            onChange={(v) => onChange({ ...block, subtext: v || undefined })}
          />
          <TextInput label="Texto del botón" value={block.buttonLabel} onChange={(v) => onChange({ ...block, buttonLabel: v })} />
        </div>
      );
    case "richText":
      return <TextArea label="HTML" value={block.html} onChange={(v) => onChange({ ...block, html: v })} />;
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}
