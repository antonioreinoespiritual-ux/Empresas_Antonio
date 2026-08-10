"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Page } from "@repo/core/domain";
import { Button, Card, Field, Input, Textarea, useToast } from "@repo/admin-ui/primitives";
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
  const { show } = useToast();
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
    const { videoUrl, ...rest } = values;
    const result = await savePageAction({
      offerId,
      kind: "THANK_YOU",
      content: { ...rest, videoUrl: videoUrl || undefined },
      expectedVersion: page?.version,
    });
    show(result.ok ? "Página guardada" : result.error ?? "No se pudo guardar", result.ok ? "success" : "danger");
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">Página de agradecimiento</h2>
        {page && (
          <PublishButton
            status={page.status}
            onToggle={() => setPageStatusAction(offerId, page.id, page.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED")}
          />
        )}
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Si está en borrador, el comprador ve el mensaje genérico de confirmación — nunca un error.
      </p>
      <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Título" htmlFor="title" error={errors.title?.message}>
          <Input id="title" invalid={!!errors.title} {...register("title")} />
        </Field>
        <Field label="Mensaje" htmlFor="message">
          <Textarea id="message" rows={4} {...register("message")} />
        </Field>
        <Field label="Video (URL)" htmlFor="videoUrl" error={errors.videoUrl ? "URL inválida" : undefined}>
          <Input id="videoUrl" invalid={!!errors.videoUrl} {...register("videoUrl")} />
        </Field>
        <Button type="submit" disabled={isSubmitting} className="self-start">
          Guardar
        </Button>
      </form>
    </Card>
  );
}
