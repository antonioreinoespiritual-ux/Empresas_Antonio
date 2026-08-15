"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { Asset, AssetKind } from "@repo/core/domain";
import { Button, Field } from "@repo/admin-ui/primitives";
import { listAssetsAction } from "../../../../media/actions";

/**
 * Selector de Assets ya subidos (Fase 6a) — reusa la biblioteca de la Fase 5,
 * nunca un input de URL libre. Sin buscador/paginación (§ "no sobre-invertir"):
 * alcanza para el tamaño actual de la biblioteca.
 */
export function AssetPicker({
  label,
  value,
  onChange,
  kindFilter,
}: {
  label: string;
  value: string | undefined;
  onChange: (assetId: string | undefined) => void;
  kindFilter?: AssetKind;
}) {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [open, setOpen] = useState(false);

  // Se busca apenas se monta (no recién al abrir el selector): si no, la
  // vista previa de "ya seleccionado" mostraría "Ningún Asset seleccionado"
  // incluso con un `value` real, hasta que el admin abriera el selector una
  // vez — un Asset asignado nunca debe parecer ausente solo porque la lista
  // todavía no cargó.
  useEffect(() => {
    listAssetsAction().then((result) => setAssets(result.assets));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una sola carga al montar, mismo criterio que el resto de listados sin paginación de esta fase.
  }, []);

  const selected = assets?.find((asset) => asset.id === value);
  const visible = kindFilter ? assets?.filter((asset) => asset.kind === kindFilter) : assets;

  return (
    <Field label={label}>
      <div className="flex flex-col gap-2">
        {selected ? (
          <div className="flex items-center gap-2">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
              {selected.kind === "IMAGE" ? (
                <Image src={selected.url} alt={selected.altText} fill className="object-cover" />
              ) : (
                // eslint-disable-next-line jsx-a11y/media-has-caption -- miniatura administrativa, no contenido publicado.
                <video src={selected.url} className="h-full w-full object-cover" muted />
              )}
            </div>
            <span className="truncate text-xs text-ink-muted">{selected.altText}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
              Quitar
            </Button>
          </div>
        ) : (
          <p className="text-xs text-ink-muted">Ningún Asset seleccionado.</p>
        )}

        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => setOpen((prev) => !prev)}>
          {open ? "Cerrar selector" : "Elegir de la biblioteca"}
        </Button>

        {open && (
          <div className="max-h-64 overflow-y-auto rounded-md border border-border p-2">
            {assets === null && <p className="text-xs text-ink-muted">Cargando...</p>}
            {assets !== null && visible?.length === 0 && (
              <p className="text-xs text-ink-muted">Todavía no hay Assets subidos en /media.</p>
            )}
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {visible?.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    onChange(asset.id);
                    setOpen(false);
                  }}
                  className="relative aspect-square overflow-hidden rounded-md border border-border bg-surface-sunken hover:ring-2 hover:ring-accent"
                  title={asset.altText}
                >
                  {asset.kind === "IMAGE" ? (
                    <Image src={asset.url} alt={asset.altText} fill className="object-cover" />
                  ) : (
                    // eslint-disable-next-line jsx-a11y/media-has-caption -- miniatura administrativa, no contenido publicado.
                    <video src={asset.url} className="h-full w-full object-cover" muted />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}
