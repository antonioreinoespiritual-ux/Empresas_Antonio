"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { THEME_IDS, type ThemeId } from "@repo/core/domain";
import { Button, Field, Select, useToast } from "@repo/admin-ui/primitives";
import { updateOfferAction } from "../../actions";

const THEME_LABELS: Record<ThemeId, string> = {
  "premium-light": "Premium Light",
  "premium-dark": "Premium Dark",
  editorial: "Editorial",
  "high-conversion": "High Conversion",
};

const schema = z.object({ themeId: z.enum(THEME_IDS) });
type FormValues = z.infer<typeof schema>;

export function EditOfferThemeForm({ offerId, defaultThemeId }: { offerId: string; defaultThemeId: ThemeId }) {
  const { show } = useToast();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { themeId: defaultThemeId } });

  async function onSubmit(values: FormValues) {
    const result = await updateOfferAction(offerId, values);
    show(result.ok ? "Theme actualizado" : result.error ?? "No se pudo guardar", result.ok ? "success" : "danger");
  }

  return (
    <form className="mt-4 flex max-w-md items-end gap-2" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex-1">
        <Field label="Theme (piel visual de la landing/checkout)" htmlFor="themeId">
          <Select id="themeId" {...register("themeId")}>
            {THEME_IDS.map((id) => (
              <option key={id} value={id}>
                {THEME_LABELS[id]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        Guardar
      </Button>
    </form>
  );
}
