"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Field, Input, useToast } from "@repo/admin-ui/primitives";
import { updateOfferAction } from "../../actions";

const schema = z.object({ name: z.string().min(1) });
type FormValues = z.infer<typeof schema>;

export function EditOfferNameForm({ offerId, defaultName }: { offerId: string; defaultName: string }) {
  const { show } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: defaultName } });

  async function onSubmit(values: FormValues) {
    const result = await updateOfferAction(offerId, values);
    show(result.ok ? "Nombre actualizado" : result.error ?? "No se pudo guardar", result.ok ? "success" : "danger");
  }

  return (
    <form className="mt-6 flex max-w-md items-end gap-2" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex-1">
        <Field label="Nombre de la oferta" htmlFor="offer-name" error={errors.name?.message}>
          <Input id="offer-name" invalid={!!errors.name} {...register("name")} />
        </Field>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        Guardar
      </Button>
    </form>
  );
}
