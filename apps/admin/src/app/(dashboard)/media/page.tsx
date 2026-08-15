import Image from "next/image";
import { PageHeader, EmptyState, Card } from "@repo/admin-ui/primitives";
import { media } from "@/lib/media";
import { UploadForm } from "./upload-form";

// Panel mínimo de Fase 5 (ARCH-LANDING-EDITOR-02 §7) — biblioteca de medios
// compartida entre Offers. El editor visual real que arrastra un Asset
// dentro de una Composition es Fase 6 (6a); esto solo sube/lista.
export default async function MediaPage() {
  const { items: assets } = await media.assets.list({ limit: 60 });

  return (
    <div>
      <PageHeader title="Medios" description="Biblioteca de imágenes y videos, compartida entre todas las Offers." />

      <div className="mb-6">
        <UploadForm />
      </div>

      {assets.length === 0 ? (
        <EmptyState title="Todavía no hay ningún Asset" description="Subí una imagen o video con el formulario de arriba." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <Card key={asset.id} className="space-y-2 p-2">
              <div className="relative aspect-square w-full overflow-hidden rounded-md bg-surface-sunken">
                {asset.kind === "IMAGE" ? (
                  <Image src={asset.url} alt={asset.altText} fill className="object-cover" />
                ) : (
                  // eslint-disable-next-line jsx-a11y/media-has-caption -- vista previa administrativa, no contenido publicado.
                  <video src={asset.url} className="h-full w-full object-cover" muted />
                )}
              </div>
              <p className="truncate text-xs text-ink-muted" title={asset.altText}>
                {asset.altText}
              </p>
              <p className="truncate text-xs text-ink-faint" title={asset.id}>
                {asset.id}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
