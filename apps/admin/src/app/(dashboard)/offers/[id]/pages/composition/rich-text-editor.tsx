"use client";

import {
  themeColorTokenSchema,
  typeScaleTokenSchema,
  type RichTextBlockNode,
  type RichTextDoc,
  type RichTextMark,
  type RichTextSpan,
  type ThemeColorToken,
  type TypeScaleToken,
} from "@repo/core/domain";
import { Button, Checkbox, Field, Input, Select } from "@repo/admin-ui/primitives";

const BLOCK_STYLES: RichTextBlockNode["style"][] = ["p", "h1", "h2", "h3", "h4"];
const SIMPLE_MARKS: Extract<RichTextMark, string>[] = ["bold", "italic", "underline", "strike", "highlight"];
const NONE = "__none__";

function isSimpleMark(mark: RichTextMark): mark is Extract<RichTextMark, string> {
  return typeof mark === "string";
}

function linkMark(marks: RichTextMark[]) {
  return marks.find((m): m is Extract<RichTextMark, { type: "link" }> => typeof m === "object" && m.type === "link");
}
function colorTokenMark(marks: RichTextMark[]) {
  return marks.find((m): m is Extract<RichTextMark, { type: "colorToken" }> => typeof m === "object" && m.type === "colorToken");
}
function sizeTokenMark(marks: RichTextMark[]) {
  return marks.find((m): m is Extract<RichTextMark, { type: "sizeToken" }> => typeof m === "object" && m.type === "sizeToken");
}

function replaceObjectMark(marks: RichTextMark[], type: "link" | "colorToken" | "sizeToken", next: RichTextMark | null): RichTextMark[] {
  const withoutType = marks.filter((m) => !(typeof m === "object" && m.type === type));
  return next ? [...withoutType, next] : withoutType;
}

function SpanEditor({ span, onChange, onRemove, removable }: { span: RichTextSpan; onChange: (next: RichTextSpan) => void; onRemove: () => void; removable: boolean }) {
  const link = linkMark(span.marks);
  const colorToken = colorTokenMark(span.marks);
  const sizeToken = sizeTokenMark(span.marks);

  function toggleSimple(mark: Extract<RichTextMark, string>) {
    const has = span.marks.some((m) => isSimpleMark(m) && m === mark);
    onChange({ ...span, marks: has ? span.marks.filter((m) => m !== mark) : [...span.marks, mark] });
  }

  return (
    <div className="rounded-md border border-dashed border-border p-2">
      <div className="flex items-start gap-2">
        <Input value={span.text} onChange={(e) => onChange({ ...span, text: e.target.value })} className="flex-1" placeholder="Texto" />
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={!removable}>
          Quitar
        </Button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        {SIMPLE_MARKS.map((mark) => (
          <label key={mark} className="flex items-center gap-1 text-xs text-ink">
            <Checkbox checked={span.marks.some((m) => isSimpleMark(m) && m === mark)} onChange={() => toggleSimple(mark)} />
            {mark}
          </label>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        <div>
          <label className="flex items-center gap-1 text-xs text-ink">
            <Checkbox
              checked={Boolean(link)}
              onChange={(e) =>
                onChange({ ...span, marks: replaceObjectMark(span.marks, "link", e.target.checked ? { type: "link", href: "https://" } : null) })
              }
            />
            Link
          </label>
          {link && (
            <Input
              className="mt-1"
              value={link.href}
              onChange={(e) => onChange({ ...span, marks: replaceObjectMark(span.marks, "link", { type: "link", href: e.target.value }) })}
              placeholder="https:// o mailto:"
            />
          )}
        </div>
        <Field label="Color (token)">
          <Select
            value={colorToken?.token ?? NONE}
            onChange={(e) =>
              onChange({
                ...span,
                marks: replaceObjectMark(
                  span.marks,
                  "colorToken",
                  e.target.value === NONE ? null : { type: "colorToken", token: e.target.value as ThemeColorToken }
                ),
              })
            }
          >
            <option value={NONE}>(sin definir)</option>
            {themeColorTokenSchema.options.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tamaño (token)">
          <Select
            value={sizeToken?.token ?? NONE}
            onChange={(e) =>
              onChange({
                ...span,
                marks: replaceObjectMark(
                  span.marks,
                  "sizeToken",
                  e.target.value === NONE ? null : { type: "sizeToken", token: e.target.value as TypeScaleToken }
                ),
              })
            }
          >
            <option value={NONE}>(sin definir)</option>
            {typeScaleTokenSchema.options.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </div>
  );
}

/**
 * Editor de rich text estructurado (Fase 4, §6) — árbol cerrado tipo
 * Portable Text, nunca HTML libre. Fase 6a: controles simples (agregar
 * bloque/span, toggles de marca) en vez de un canvas WYSIWYG con
 * contentEditable — evita instalar una librería de editor pesada antes de
 * ver uso real (§ "no sobre-invertir"), consistente con que 6b (canvas) es
 * explícitamente una fase futura separada.
 */
export function RichTextEditor({ doc, onChange }: { doc: RichTextDoc; onChange: (next: RichTextDoc) => void }) {
  function updateBlock(index: number, next: RichTextBlockNode) {
    onChange(doc.map((block, i) => (i === index ? next : block)));
  }
  function removeBlock(index: number) {
    onChange(doc.filter((_, i) => i !== index));
  }
  function addBlock() {
    onChange([...doc, { style: "p", children: [{ text: "", marks: [] }] }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {doc.map((block, blockIndex) => (
        <div key={blockIndex} className="rounded-md border border-border p-2">
          <div className="flex items-center justify-between gap-2">
            <Select
              className="w-auto"
              value={block.style}
              onChange={(e) => updateBlock(blockIndex, { ...block, style: e.target.value as RichTextBlockNode["style"] })}
            >
              {BLOCK_STYLES.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </Select>
            <Button type="button" variant="ghost" size="sm" onClick={() => removeBlock(blockIndex)} disabled={doc.length <= 1}>
              Quitar bloque
            </Button>
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {block.children.map((span, spanIndex) => (
              <SpanEditor
                key={spanIndex}
                span={span}
                removable={block.children.length > 1}
                onChange={(next) => updateBlock(blockIndex, { ...block, children: block.children.map((s, i) => (i === spanIndex ? next : s)) })}
                onRemove={() => updateBlock(blockIndex, { ...block, children: block.children.filter((_, i) => i !== spanIndex) })}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1.5"
            onClick={() => updateBlock(blockIndex, { ...block, children: [...block.children, { text: "", marks: [] }] })}
          >
            + Agregar texto
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={addBlock}>
        + Agregar párrafo/encabezado
      </Button>
    </div>
  );
}
