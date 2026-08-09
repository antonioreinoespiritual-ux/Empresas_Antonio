"use client";

import type { ReactNode } from "react";
import type { LandingBlock } from "@repo/core/domain";
import { Button, Checkbox, Field, Input, Textarea } from "@repo/admin-ui/primitives";

type BenefitItem = Extract<LandingBlock, { type: "benefits" }>["items"][number];
type TestimonialItem = Extract<LandingBlock, { type: "testimonials" }>["items"][number];
type FaqItem = Extract<LandingBlock, { type: "faq" }>["items"][number];

function TextField({
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
    <Field label={label}>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} />
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
      <TextField label="Encabezado (opcional)" value={heading ?? ""} onChange={onHeadingChange} />
      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <div key={index} className="rounded-md border border-dashed border-border p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-muted">Elemento {index + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeItem(index)}
                disabled={items.length <= 1}
              >
                Quitar
              </Button>
            </div>
            <div className="mt-1.5 flex flex-col gap-2">{renderItem(item, (next) => updateItem(index, next))}</div>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => onItemsChange([...items, newItem()])}>
        + Agregar elemento
      </Button>
    </div>
  );
}

/** Formulario específico según el tipo de bloque — un caso por cada miembro de LandingBlock, sin HTML libre salvo richText. */
export function BlockFields({ block, onChange }: { block: LandingBlock; onChange: (next: LandingBlock) => void }) {
  switch (block.type) {
    case "hero":
      return (
        <div className="flex flex-col gap-2">
          <TextField label="Título" value={block.title} onChange={(v) => onChange({ ...block, title: v })} />
          <TextField
            label="Subtítulo (opcional)"
            value={block.subtitle ?? ""}
            onChange={(v) => onChange({ ...block, subtitle: v || undefined })}
          />
          <TextField
            label="URL de imagen de fondo (opcional)"
            value={block.backgroundImageUrl ?? ""}
            onChange={(v) => onChange({ ...block, backgroundImageUrl: v || undefined })}
          />
          <TextField label="Texto del botón" value={block.ctaLabel} onChange={(v) => onChange({ ...block, ctaLabel: v })} />
        </div>
      );
    case "vsl":
      return (
        <div className="flex flex-col gap-2">
          <TextField label="URL del video (embed)" value={block.embedUrl} onChange={(v) => onChange({ ...block, embedUrl: v })} />
          <TextField
            label="Imagen de portada (opcional)"
            value={block.posterImageUrl ?? ""}
            onChange={(v) => onChange({ ...block, posterImageUrl: v || undefined })}
          />
          <CheckboxField
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
              <TextField label="Título" value={item.title} onChange={(v) => update({ ...item, title: v })} />
              <TextField label="Descripción" value={item.description} onChange={(v) => update({ ...item, description: v })} />
              <TextField
                label="Ícono (opcional, un emoji)"
                value={item.icon ?? ""}
                onChange={(v) => update({ ...item, icon: v || undefined })}
              />
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
              <TextAreaField label="Testimonio" value={item.quote} onChange={(v) => update({ ...item, quote: v })} />
              <TextField label="Nombre" value={item.authorName} onChange={(v) => update({ ...item, authorName: v })} />
              <TextField
                label="Rol (opcional)"
                value={item.authorRole ?? ""}
                onChange={(v) => update({ ...item, authorRole: v || undefined })}
              />
              <TextField
                label="URL de foto (opcional)"
                value={item.avatarUrl ?? ""}
                onChange={(v) => update({ ...item, avatarUrl: v || undefined })}
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
              <TextField label="Pregunta" value={item.question} onChange={(v) => update({ ...item, question: v })} />
              <TextAreaField label="Respuesta" value={item.answer} onChange={(v) => update({ ...item, answer: v })} />
            </>
          )}
        />
      );
    case "guarantee":
      return (
        <div className="flex flex-col gap-2">
          <TextField label="Título" value={block.title} onChange={(v) => onChange({ ...block, title: v })} />
          <TextAreaField label="Descripción" value={block.description} onChange={(v) => onChange({ ...block, description: v })} />
          <TextField
            label="Ícono del sello (opcional, un emoji)"
            value={block.badgeIcon ?? ""}
            onChange={(v) => onChange({ ...block, badgeIcon: v || undefined })}
          />
        </div>
      );
    case "cta":
      return (
        <div className="flex flex-col gap-2">
          <TextField
            label="Titular (opcional)"
            value={block.headline ?? ""}
            onChange={(v) => onChange({ ...block, headline: v || undefined })}
          />
          <TextField
            label="Subtexto (opcional)"
            value={block.subtext ?? ""}
            onChange={(v) => onChange({ ...block, subtext: v || undefined })}
          />
          <TextField label="Texto del botón" value={block.buttonLabel} onChange={(v) => onChange({ ...block, buttonLabel: v })} />
        </div>
      );
    case "richText":
      return <TextAreaField label="HTML" value={block.html} onChange={(v) => onChange({ ...block, html: v })} />;
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}
