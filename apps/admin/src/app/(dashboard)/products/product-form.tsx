"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createProductAction, updateProductAction } from "./actions";

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(["DIGITAL", "PHYSICAL", "SERVICE", "SUBSCRIPTION"]),
});

type FormValues = z.infer<typeof schema>;

export function ProductForm({ productId, defaultValues }: { productId?: string; defaultValues?: FormValues }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? { type: "DIGITAL", name: "" },
  });

  async function onSubmit(values: FormValues) {
    if (productId) {
      await updateProductAction(productId, values);
    } else {
      await createProductAction(values);
    }
    router.push("/products");
  }

  return (
    <form className="mt-6 flex max-w-md flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="block text-sm font-medium">Nombre</label>
        <input className="mt-1 w-full rounded border px-3 py-2" {...register("name")} />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium">Tipo</label>
        <select className="mt-1 w-full rounded border px-3 py-2" {...register("type")}>
          <option value="DIGITAL">Digital</option>
          <option value="PHYSICAL">Físico</option>
          <option value="SERVICE">Servicio</option>
          <option value="SUBSCRIPTION">Suscripción</option>
        </select>
      </div>
      <button
        className="self-start rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        type="submit"
        disabled={isSubmitting}
      >
        Guardar
      </button>
    </form>
  );
}
