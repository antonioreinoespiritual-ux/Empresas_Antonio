"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Field, Input, Select, useToast } from "@repo/admin-ui/primitives";
import { createProductAction, updateProductAction } from "./actions";

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(["DIGITAL", "PHYSICAL", "SERVICE", "SUBSCRIPTION"]),
});

type FormValues = z.infer<typeof schema>;

export function ProductForm({ productId, defaultValues }: { productId?: string; defaultValues?: FormValues }) {
  const router = useRouter();
  const { show } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? { type: "DIGITAL", name: "" },
  });

  async function onSubmit(values: FormValues) {
    const result = productId ? await updateProductAction(productId, values) : await createProductAction(values);
    if (!result.ok) {
      show(result.error ?? "No se pudo guardar el producto", "danger");
      return;
    }
    show(productId ? "Producto actualizado" : "Producto creado");
    router.push("/products");
  }

  return (
    <form className="mt-6 flex max-w-md flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <Field label="Nombre" htmlFor="name" error={errors.name?.message}>
        <Input id="name" invalid={!!errors.name} {...register("name")} />
      </Field>
      <Field label="Tipo" htmlFor="type">
        <Select id="type" {...register("type")}>
          <option value="DIGITAL">Digital</option>
          <option value="PHYSICAL">Físico</option>
          <option value="SERVICE">Servicio</option>
          <option value="SUBSCRIPTION">Suscripción</option>
        </Select>
      </Field>
      <Button type="submit" disabled={isSubmitting} className="self-start">
        Guardar
      </Button>
    </form>
  );
}
