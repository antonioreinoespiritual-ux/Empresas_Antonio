"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Page } from "@repo/core/domain";
import { savePageAction, setPageStatusAction } from "./actions";
import { PublishButton } from "./publish-button";

const schema = z.object({
  title: z.string().min(1),
  message: z.string().optional(),
  videoUrl: z.union([z.string().url(), z.literal("")]).optional(),
});
type FormValues = z.infer<typeof schema>;

interface ThankYouContent {
  title?: string;
  message?: string;
  videoUrl?: string;
}

export function ThankYouPageForm({ offerId, page }: { offerId: string; page: Page | null }) {
  const [error, setError] = useState<string | null>(null);
  const content = (page?.content ?? {}) as ThankYouContent;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: content.title ?? "¡Gracias por tu compra!",
      message: content.message ?? "",
      videoUrl: content.videoUrl ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    const { videoUrl, ...rest } = values;
    const result = await savePageAction({
      offerId,
      kind: "THANK_YOU",
      content: { ...rest, videoUrl: videoUrl || undefined },
    });
    if (!result.ok) setError(result.error ?? "No se pudo guardar");
  }

  return (
    <section className="rounded border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Página de agradecimiento</h2>
        {page && (
          <PublishButton
            status={page.status}
            onToggle={() =>
              setPageStatusAction(offerId, page.id, page.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED")
            }
          />
        )}
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Si está en borrador, el comprador ve el mensaje genérico de confirmación — nunca un error.
      </p>
      <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="block text-sm font-medium">Título</label>
          <input className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register("title")} />
          {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium">Mensaje</label>
          <textarea className="mt-1 w-full rounded border px-3 py-2 text-sm" rows={4} {...register("message")} />
        </div>
        <div>
          <label className="block text-sm font-medium">Video (URL)</label>
          <input className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register("videoUrl")} />
          {errors.videoUrl && <p className="mt-1 text-sm text-red-600">URL inválida</p>}
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
