"use client";

import type { CompositionNode } from "@repo/core/domain";
import { Button, Checkbox, Field, Input } from "@repo/admin-ui/primitives";
import { BlockFields } from "../block-fields";
import { AssetPicker } from "./asset-picker";
import { RichTextEditor } from "./rich-text-editor";
import { StyleEditor } from "./style-editor";

const SHAPE_VARIANTS = ["dot", "line", "blob"] as const;

/**
 * Formulario de `content` específico por tipo de nodo (Fase 6a) — un caso
 * por cada tipo de `ElementNode`, mismo criterio que `BlockFields` para los
 * bloques legacy. `section`/`row` no tienen `content` propio (solo
 * `children`, gestionados desde el árbol) — acá solo editan su `style`.
 */
export function NodeContentEditor({
  node,
  isRowChild,
  onChangeContent,
  onChangeStyle,
}: {
  node: CompositionNode;
  isRowChild: boolean;
  onChangeContent: (content: unknown) => void;
  onChangeStyle: (style: unknown) => void;
}) {
  const style = "style" in node ? node.style : undefined;
  const styleEditor = <StyleEditor style={style} onChange={onChangeStyle} showColumnSpan={isRowChild} />;

  switch (node.type) {
    case "section":
    case "row":
      return styleEditor;

    case "richText":
      return (
        <div className="flex flex-col gap-2">
          {styleEditor}
          <RichTextEditor doc={node.content} onChange={onChangeContent} />
        </div>
      );

    case "image":
      return (
        <div className="flex flex-col gap-2">
          {styleEditor}
          <AssetPicker
            label="Imagen"
            value={node.content.assetId}
            kindFilter="IMAGE"
            onChange={(assetId) => assetId && onChangeContent({ ...node.content, assetId })}
          />
          <Field label="Texto alternativo">
            <Input value={node.content.altText} onChange={(e) => onChangeContent({ ...node.content, altText: e.target.value })} />
          </Field>
        </div>
      );

    case "video": {
      const source = node.content.source;
      return (
        <div className="flex flex-col gap-2">
          {styleEditor}
          <div className="flex gap-3 text-sm text-ink">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={source.kind === "embed"}
                onChange={() => onChangeContent({ ...node.content, source: { kind: "embed", embedUrl: "https://" } })}
              />
              Embed externo (VSL)
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={source.kind === "asset"}
                onChange={() => onChangeContent({ ...node.content, source: { kind: "asset", assetId: "" } })}
              />
              Video propio
            </label>
          </div>
          {source.kind === "embed" ? (
            <Field label="URL del embed">
              <Input value={source.embedUrl} onChange={(e) => onChangeContent({ ...node.content, source: { kind: "embed", embedUrl: e.target.value } })} />
            </Field>
          ) : (
            <>
              <AssetPicker
                label="Video"
                value={source.assetId || undefined}
                kindFilter="VIDEO"
                onChange={(assetId) => onChangeContent({ ...node.content, source: { ...source, assetId: assetId ?? "" } })}
              />
              <AssetPicker
                label="Imagen de portada (opcional, requerida para autoplay)"
                value={source.posterAssetId}
                kindFilter="IMAGE"
                onChange={(assetId) => onChangeContent({ ...node.content, source: { ...source, posterAssetId: assetId } })}
              />
            </>
          )}
          <label className="flex items-center gap-2 text-sm text-ink">
            <Checkbox checked={node.content.autoplay} onChange={(e) => onChangeContent({ ...node.content, autoplay: e.target.checked })} />
            Reproducir automáticamente (requiere portada, queda mute)
          </label>
        </div>
      );
    }

    case "gallery":
      return (
        <div className="flex flex-col gap-2">
          {styleEditor}
          <div className="flex flex-col gap-2">
            {node.content.items.map((item, index) => (
              <div key={index} className="rounded-md border border-dashed border-border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-muted">Imagen {index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={node.content.items.length <= 1}
                    onClick={() => onChangeContent({ items: node.content.items.filter((_, i) => i !== index) })}
                  >
                    Quitar
                  </Button>
                </div>
                <AssetPicker
                  label="Imagen"
                  value={item.assetId}
                  kindFilter="IMAGE"
                  onChange={(assetId) =>
                    assetId && onChangeContent({ items: node.content.items.map((it, i) => (i === index ? { ...it, assetId } : it)) })
                  }
                />
                <Field label="Texto alternativo">
                  <Input
                    value={item.altText}
                    onChange={(e) => onChangeContent({ items: node.content.items.map((it, i) => (i === index ? { ...it, altText: e.target.value } : it)) })}
                  />
                </Field>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => onChangeContent({ items: [...node.content.items, { assetId: "", altText: "" }] })}
          >
            + Agregar imagen
          </Button>
        </div>
      );

    case "icon":
      return (
        <div className="flex flex-col gap-2">
          {styleEditor}
          <Field label="Nombre del ícono">
            <Input value={node.content.name} onChange={(e) => onChangeContent({ name: e.target.value })} />
          </Field>
        </div>
      );

    case "divider":
    case "spacer":
      return styleEditor;

    case "button":
      return (
        <div className="flex flex-col gap-2">
          {styleEditor}
          <Field label="Texto del botón">
            <Input value={node.content.label} onChange={(e) => onChangeContent({ ...node.content, label: e.target.value })} />
          </Field>
          <Field label="URL (https:// o mailto:)">
            <Input value={node.content.href} onChange={(e) => onChangeContent({ ...node.content, href: e.target.value })} />
          </Field>
        </div>
      );

    case "shape":
      return (
        <div className="flex flex-col gap-2">
          {styleEditor}
          <Field label="Variante">
            <select
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink"
              value={node.content.variant}
              onChange={(e) => onChangeContent({ variant: e.target.value })}
            >
              {SHAPE_VARIANTS.map((variant) => (
                <option key={variant} value={variant}>
                  {variant}
                </option>
              ))}
            </select>
          </Field>
        </div>
      );

    case "legacyBlock":
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-ink-muted">Bloque clásico envuelto — mismo formulario que el editor de bloques.</p>
          <BlockFields block={node.content.block} onChange={(block) => onChangeContent({ block })} />
        </div>
      );

    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}
