"use client";

import { useState, type FormEvent } from "react";
import { Button, Card, Field, Input, useToast } from "@repo/admin-ui/primitives";
import type { AssetKind } from "@repo/core/domain";
import { createUploadUrlAction, registerAssetAction } from "./actions";

function kindForContentType(contentType: string): AssetKind | null {
  if (contentType.startsWith("image/")) return "IMAGE";
  if (contentType.startsWith("video/")) return "VIDEO";
  return null;
}

/** Dimensiones reales solo para imágenes (barato, `<img>` nativo) — para video se registra sin width/height, VideoNode no las necesita. */
function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export function UploadForm() {
  const { show } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || !altText.trim()) return;

    const kind = kindForContentType(file.type);
    if (!kind) {
      setError(`Tipo de archivo no soportado: ${file.type || "desconocido"}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const uploadUrlResult = await createUploadUrlAction(kind, file.type);
      if (!uploadUrlResult.ok || !uploadUrlResult.uploadUrl || !uploadUrlResult.path) {
        setError(uploadUrlResult.error ?? "No se pudo iniciar la subida");
        return;
      }

      const putResponse = await fetch(uploadUrlResult.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putResponse.ok) {
        setError("La subida al storage falló");
        return;
      }

      const dimensions = kind === "IMAGE" ? await readImageDimensions(file) : null;
      const registerResult = await registerAssetAction({
        kind,
        path: uploadUrlResult.path,
        altText: altText.trim(),
        width: dimensions?.width,
        height: dimensions?.height,
      });
      if (!registerResult.ok) {
        setError(registerResult.error ?? "No se pudo registrar el archivo");
        return;
      }

      show("Archivo subido");
      setFile(null);
      setAltText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-4">
        <Field label="Archivo" hint="Imágenes: jpg/png/webp/gif. Videos: mp4/webm.">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </Field>
        <Field label="Texto alternativo" htmlFor="altText">
          <Input id="altText" value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Describe la imagen/video" />
        </Field>
        <Button type="submit" disabled={!file || !altText.trim() || isSubmitting}>
          {isSubmitting ? "Subiendo..." : "Subir"}
        </Button>
        {error && <p className="w-full text-sm text-danger">{error}</p>}
      </form>
    </Card>
  );
}
