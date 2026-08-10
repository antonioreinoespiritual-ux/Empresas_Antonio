"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Page } from "@repo/core/domain";
import { Button, Card, Field, Input, useToast } from "@repo/admin-ui/primitives";
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
  const { show } = useToast();
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
    const result = await savePageAction({ offerId, kind: "CHECKOUT", content: values, expectedVersion: page?.version });
    show(result.ok ? "Página guardada" : result.error ?? "No se pudo guardar", result.ok ? "success" : "danger");
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">Página de checkout</h2>
        {page && (
          <PublishButton
            status={page.status}
            onToggle={() => setPageStatusAction(offerId, page.id, page.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED")}
          />
        )}
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Si está en borrador, el checkout sigue funcionando con textos genéricos — despublicar aquí solo oculta este
        copy personalizado, nunca bloquea el cobro de una oferta activa.
      </p>
      <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Título" htmlFor="headline">
          <Input id="headline" {...register("headline")} />
        </Field>
        <Field label="Subtítulo" htmlFor="subheadline">
          <Input id="subheadline" {...register("subheadline")} />
        </Field>
        <Button type="submit" disabled={isSubmitting} className="self-start">
          Guardar
        </Button>
      </form>
    </Card>
  );
}
