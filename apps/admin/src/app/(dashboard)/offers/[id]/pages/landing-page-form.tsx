"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Page } from "@repo/core/domain";
import { savePageAction, setPageStatusAction } from "./actions";
import { PublishButton } from "./publish-button";

const schema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  heroTitle: z.string().min(1),
  heroSubtitle: z.string().optional(),
  vslEmbedUrl: z.union([z.string().url(), z.literal("")]).optional(),
  bodyHtml: z.string().optional(),
  ctaLabel: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface LandingContent {
  heroTitle?: string;
  heroSubtitle?: string;
  vslEmbedUrl?: string;
  bodyHtml?: string;
  ctaLabel?: string;
}

export function LandingPageForm({ offerId, page }: { offerId: string; page: Page | null }) {
  const [error, setError] = useState<string | null>(null);
  const content = (page?.content ?? {}) as LandingContent;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      slug: page?.slug ?? "",
      heroTitle: content.heroTitle ?? "",
      heroSubtitle: content.heroSubtitle ?? "",
      vslEmbedUrl: content.vslEmbedUrl ?? "",
      bodyHtml: content.bodyHtml ?? "",
      ctaLabel: content.ctaLabel ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    const { slug, vslEmbedUrl, ...rest } = values;
    const result = await savePageAction({
      offerId,
      kind: "LANDING",
      slug,
      content: { ...rest, vslEmbedUrl: vslEmbedUrl || undefined },
    });
    if (!result.ok) setError(result.error ?? "No se pudo guardar");
  }

  return (
    <section className="rounded border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Página de ventas (landing)</h2>
        {page && (
          <PublishButton
            status={page.status}
            onToggle={() =>
              setPageStatusAction(offerId, page.id, page.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED")
            }
          />
        )}
      </div>
      {page?.slug && (
        <p className="mt-1 text-xs text-neutral-500">
          URL pública: <code>/{page.slug}</code>
        </p>
      )}
      <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="block text-sm font-medium">Slug (URL)</label>
          <input className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register("slug")} />
          {errors.slug && <p className="mt-1 text-sm text-red-600">{errors.slug.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Título principal</label>
          <input className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register("heroTitle")} />
          {errors.heroTitle && <p className="mt-1 text-sm text-red-600">{errors.heroTitle.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Subtítulo</label>
          <input className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register("heroSubtitle")} />
        </div>
        <div>
          <label className="block text-sm font-medium">URL del VSL (embed)</label>
          <input className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register("vslEmbedUrl")} />
          {errors.vslEmbedUrl && <p className="mt-1 text-sm text-red-600">URL inválida</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Contenido (HTML)</label>
          <textarea className="mt-1 w-full rounded border px-3 py-2 text-sm" rows={6} {...register("bodyHtml")} />
        </div>
        <div>
          <label className="block text-sm font-medium">Texto del botón</label>
          <input className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register("ctaLabel")} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="self-start rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          type="submit"
          disabled={isSubmitting}
        >
          Guardar
        </button>
      </form>
    </section>
  );
}
