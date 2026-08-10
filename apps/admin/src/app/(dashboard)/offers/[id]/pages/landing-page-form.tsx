"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Page } from "@repo/core/domain";
import { Button, Card, Field, Input, Textarea, useToast } from "@repo/admin-ui/primitives";
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
  const { show } = useToast();
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
    const { slug, vslEmbedUrl, ...rest } = values;
    const result = await savePageAction({
      offerId,
      kind: "LANDING",
      slug,
      content: { ...rest, vslEmbedUrl: vslEmbedUrl || undefined },
      expectedVersion: page?.version,
    });
    show(result.ok ? "Página guardada" : result.error ?? "No se pudo guardar", result.ok ? "success" : "danger");
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">Página de ventas (landing)</h2>
        {page && (
          <PublishButton
            status={page.status}
            onToggle={() => setPageStatusAction(offerId, page.id, page.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED")}
          />
        )}
      </div>
      {page?.slug && (
        <p className="mt-1 text-xs text-ink-muted">
          URL pública: <code>/{page.slug}</code>
        </p>
      )}
      <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)}>
        <Field label="Slug (URL)" htmlFor="slug" error={errors.slug?.message}>
          <Input id="slug" invalid={!!errors.slug} {...register("slug")} />
        </Field>
        <Field label="Título principal" htmlFor="heroTitle" error={errors.heroTitle?.message}>
          <Input id="heroTitle" invalid={!!errors.heroTitle} {...register("heroTitle")} />
        </Field>
        <Field label="Subtítulo" htmlFor="heroSubtitle">
          <Input id="heroSubtitle" {...register("heroSubtitle")} />
        </Field>
        <Field label="URL del VSL (embed)" htmlFor="vslEmbedUrl" error={errors.vslEmbedUrl ? "URL inválida" : undefined}>
          <Input id="vslEmbedUrl" invalid={!!errors.vslEmbedUrl} {...register("vslEmbedUrl")} />
        </Field>
        <Field label="Contenido (HTML)" htmlFor="bodyHtml">
          <Textarea id="bodyHtml" rows={6} {...register("bodyHtml")} />
        </Field>
        <Field label="Texto del botón" htmlFor="ctaLabel">
          <Input id="ctaLabel" {...register("ctaLabel")} />
        </Field>
        <Button type="submit" disabled={isSubmitting} className="self-start">
          Guardar
        </Button>
      </form>
    </Card>
  );
}
