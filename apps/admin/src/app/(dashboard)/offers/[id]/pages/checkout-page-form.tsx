"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Page } from "@repo/core/domain";
import { savePageAction, setPageStatusAction } from "./actions";
import { PublishButton } from "./publish-button";

const schema = z.object({
  headline: z.string().optional(),
  subheadline: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface CheckoutContent {
  headline?: string;
  subheadline?: string;
}

export function CheckoutPageForm({ offerId, page }: { offerId: string; page: Page | null }) {
  const [error, setError] = useState<string | null>(null);
  const content = (page?.content ?? {}) as CheckoutContent;
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { headline: content.headline ?? "", subheadline: content.subheadline ?? "" },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    const result = await savePageAction({ offerId, kind: "CHECKOUT", content: values });
    if (!result.ok) setError(result.error ?? "No se pudo guardar");
  }

  return (
    <section className="rounded border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Página de checkout</h2>
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
        Si está en borrador, el checkout sigue funcionando con textos genéricos — despublicar aquí solo oculta
        este copy personalizado, nunca bloquea el cobro de una oferta activa.
      </p>
      <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="block text-sm font-medium">Título</label>
          <input className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register("headline")} />
        </div>
        <div>
          <label className="block text-sm font-medium">Subtítulo</label>
          <input className="mt-1 w-full rounded border px-3 py-2 text-sm" {...register("subheadline")} />
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
