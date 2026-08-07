"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { createOfferAction } from "./actions";

const priceSchema = z.object({
  amount: z.coerce.number().int().positive(),
  currency: z.string().length(3),
  interval: z.enum(["ONE_TIME", "RECURRING"]),
});

const schema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  prices: z.array(priceSchema).min(1),
});

type FormValues = z.infer<typeof schema>;

export function OfferForm({ products }: { products: { id: string; name: string }[] }) {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      productId: "",
      name: "",
      prices: [{ amount: 0, currency: "COP", interval: "ONE_TIME" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "prices" });

  async function onSubmit(values: FormValues) {
    await createOfferAction(values);
    router.push("/offers");
  }

  return (
    <form className="mt-6 flex max-w-xl flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="block text-sm font-medium">Producto</label>
        <select className="mt-1 w-full rounded border px-3 py-2" {...register("productId")}>
          <option value="">Selecciona un producto</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        {errors.productId && <p className="mt-1 text-sm text-red-600">{errors.productId.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium">Nombre de la oferta</label>
        <input className="mt-1 w-full rounded border px-3 py-2" {...register("name")} />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <fieldset className="rounded border p-4">
        <legend className="text-sm font-medium">Precios</legend>
        {fields.map((field, index) => (
          <div key={field.id} className="mt-2 flex items-center gap-2">
            <input
              className="w-32 rounded border px-2 py-1"
              type="number"
              placeholder="Monto (centavos)"
              {...register(`prices.${index}.amount`)}
            />
            <input className="w-20 rounded border px-2 py-1" placeholder="COP" {...register(`prices.${index}.currency`)} />
            <select className="rounded border px-2 py-1" {...register(`prices.${index}.interval`)}>
              <option value="ONE_TIME">Pago único</option>
              <option value="RECURRING">Recurrente</option>
            </select>
            {fields.length > 1 && (
              <button type="button" className="text-sm text-red-600 underline" onClick={() => remove(index)}>
                Quitar
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="mt-2 text-sm underline"
          onClick={() => append({ amount: 0, currency: "COP", interval: "ONE_TIME" })}
        >
          + Agregar precio
        </button>
        {errors.prices && <p className="mt-1 text-sm text-red-600">Revisa los precios ingresados</p>}
      </fieldset>

      <button
        className="self-start rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        type="submit"
        disabled={isSubmitting}
      >
        Crear oferta
      </button>
    </form>
  );
}
