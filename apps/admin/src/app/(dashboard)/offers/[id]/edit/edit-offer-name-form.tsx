"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { updateOfferAction } from "../../actions";

const schema = z.object({ name: z.string().min(1) });
type FormValues = z.infer<typeof schema>;

export function EditOfferNameForm({ offerId, defaultName }: { offerId: string; defaultName: string }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: defaultName } });

  async function onSubmit(values: FormValues) {
    await updateOfferAction(offerId, values);
  }

  return (
    <form className="mt-6 flex max-w-md items-end gap-2" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex-1">
        <label className="block text-sm font-medium">Nombre de la oferta</label>
        <input className="mt-1 w-full rounded border px-3 py-2" {...register("name")} />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
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
