"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { THEME_IDS, type ThemeId } from "@repo/core/domain";
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
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { themeId: defaultThemeId } });

  async function onSubmit(values: FormValues) {
    await updateOfferAction(offerId, values);
  }

  return (
    <form className="mt-4 flex max-w-md items-end gap-2" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex-1">
        <label className="block text-sm font-medium">Theme (piel visual de la landing/checkout)</label>
        <select className="mt-1 w-full rounded border px-3 py-2" {...register("themeId")}>
          {THEME_IDS.map((id) => (
            <option key={id} value={id}>
              {THEME_LABELS[id]}
            </option>
          ))}
        </select>
      </div>
      <button
        className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        type="submit"
        disabled={isSubmitting}
      >
        Guardar
      </button>
    </form>
  );
}
