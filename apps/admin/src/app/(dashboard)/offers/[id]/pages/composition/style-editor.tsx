"use client";

import {
  alignTokenSchema,
  heightScaleTokenSchema,
  overlayTokenSchema,
  spacingTokenSchema,
  themeColorTokenSchema,
  typeScaleTokenSchema,
  weightTokenSchema,
  widthScaleTokenSchema,
  type StyleProps,
} from "@repo/core/domain";
import { Field, Select } from "@repo/admin-ui/primitives";
import { AssetPicker } from "./asset-picker";

const NONE = "__none__";

function TokenSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: readonly T[];
  onChange: (value: T | undefined) => void;
}) {
  return (
    <Field label={label}>
      <Select value={value ?? NONE} onChange={(e) => onChange(e.target.value === NONE ? undefined : (e.target.value as T))}>
        <option value={NONE}>(sin definir)</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/**
 * Editor de StyleProps (Fase 6a, ARCH-LANDING-EDITOR-02 §5) — selectores
 * sobre el vocabulario cerrado de tokens, nunca inputs de CSS libre. Sin
 * `responsive.md/lg` todavía (§ "no sobre-invertir" de F6): el override por
 * breakpoint queda para cuando haya uso real que lo pida.
 */
export function StyleEditor({
  style,
  onChange,
  showColumnSpan,
}: {
  style: StyleProps | undefined;
  onChange: (next: StyleProps | undefined) => void;
  /** Solo tiene efecto real en un nodo que sea hijo directo de una row (ARCH-LANDING-EDITOR-02 §8). */
  showColumnSpan: boolean;
}) {
  const s = style ?? {};

  function patch(next: Partial<StyleProps>) {
    const merged: StyleProps = { ...s, ...next };
    // undefined si queda vacío, para no acumular `{}` sueltos en el JSON guardado.
    const hasAnyField = Object.values(merged).some((v) => v !== undefined);
    onChange(hasAnyField ? merged : undefined);
  }

  return (
    <details className="rounded-md border border-dashed border-border p-2">
      <summary className="cursor-pointer text-xs font-medium text-ink-muted">Estilo (opcional)</summary>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <TokenSelect
          label="Espaciado arriba"
          value={s.spacing?.top}
          options={spacingTokenSchema.options}
          onChange={(v) => patch({ spacing: { ...s.spacing, top: v } })}
        />
        <TokenSelect
          label="Espaciado abajo"
          value={s.spacing?.bottom}
          options={spacingTokenSchema.options}
          onChange={(v) => patch({ spacing: { ...s.spacing, bottom: v } })}
        />
        <TokenSelect
          label="Espaciado horizontal"
          value={s.spacing?.x}
          options={spacingTokenSchema.options}
          onChange={(v) => patch({ spacing: { ...s.spacing, x: v } })}
        />
        <TokenSelect
          label="Color de fondo"
          value={s.background?.colorToken}
          options={themeColorTokenSchema.options}
          onChange={(v) => patch({ background: { ...s.background, colorToken: v } })}
        />
        <TokenSelect
          label="Overlay de fondo"
          value={s.background?.overlay}
          options={overlayTokenSchema.options}
          onChange={(v) => patch({ background: { ...s.background, overlay: v } })}
        />
        <TokenSelect
          label="Tamaño de texto"
          value={s.typography?.sizeToken}
          options={typeScaleTokenSchema.options}
          onChange={(v) => patch({ typography: { ...s.typography, sizeToken: v } })}
        />
        <TokenSelect
          label="Peso de texto"
          value={s.typography?.weightToken}
          options={weightTokenSchema.options}
          onChange={(v) => patch({ typography: { ...s.typography, weightToken: v } })}
        />
        <TokenSelect
          label="Alineación de texto"
          value={s.typography?.alignToken}
          options={alignTokenSchema.options}
          onChange={(v) => patch({ typography: { ...s.typography, alignToken: v } })}
        />
        <TokenSelect
          label="Color de texto"
          value={s.color?.textToken}
          options={themeColorTokenSchema.options}
          onChange={(v) => patch({ color: { textToken: v } })}
        />
        <TokenSelect
          label="Ancho"
          value={s.layout?.widthToken}
          options={widthScaleTokenSchema.options}
          onChange={(v) => patch({ layout: { ...s.layout, widthToken: v } })}
        />
        <TokenSelect
          label="Alto"
          value={s.layout?.heightToken}
          options={heightScaleTokenSchema.options}
          onChange={(v) => patch({ layout: { ...s.layout, heightToken: v } })}
        />
        {showColumnSpan && (
          <Field label="Ancho de columna (1-12)">
            <Select
              value={String(s.layout?.columnSpan ?? 12)}
              onChange={(e) => patch({ layout: { ...s.layout, columnSpan: Number(e.target.value) } })}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <div className="mt-2">
        <AssetPicker
          label="Imagen de fondo (opcional)"
          value={s.background?.imageAssetId}
          kindFilter="IMAGE"
          onChange={(assetId) => patch({ background: { ...s.background, imageAssetId: assetId } })}
        />
      </div>
    </details>
  );
}
