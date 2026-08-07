"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { isProviderCompatibleWithCurrency, type Price } from "@repo/core/domain";
import { addPriceAction, removePriceAction } from "../../actions";

const schema = z.object({
  amount: z.coerce.number().int().positive(),
  currency: z.string().length(3),
  interval: z.enum(["ONE_TIME", "RECURRING"]),
});
type FormValues = z.infer<typeof schema>;

export function PriceManager({ offerId, prices }: { offerId: string; prices: Price[] }) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 0, currency: "COP", interval: "ONE_TIME" },
  });

  async function onSubmit(values: FormValues) {
    await addPriceAction(offerId, values);
    reset({ amount: 0, currency: "COP", interval: "ONE_TIME" });
  }

  async function onRemove(priceId: string) {
    setRemovingId(priceId);
    setRemoveError(null);
    const result = await removePriceAction(offerId, priceId);
    setRemovingId(null);
    if (!result.ok) {
      setRemoveError(result.error ?? "No se pudo quitar el precio");
    }
  }

  return (
    <section className="mt-8 max-w-xl">
      <h2 className="text-lg font-medium">Precios</h2>
      <ul className="mt-2 divide-y">
        {prices.map((price) => (
          <li key={price.id} className="flex items-center justify-between py-2 text-sm">
            <span>
              {(price.amount / 100).toLocaleString("es-CO", { style: "currency", currency: price.currency })} (
              {price.interval}) —{" "}
              {isProviderCompatibleWithCurrency("PAYPAL", price.currency) ? "Wompi + PayPal" : "solo Wompi"}
            </span>
            <button
              type="button"
              className="text-red-600 underline disabled:opacity-50"
              disabled={removingId === price.id}
              onClick={() => onRemove(price.id)}
            >
              Quitar
            </button>
          </li>
        ))}
        {prices.length === 0 && <li className="py-2 text-sm text-neutral-500">Sin precios todavía.</li>}
      </ul>
      {removeError && <p className="mt-1 text-sm text-red-600">{removeError}</p>}

      <p className="mt-4 text-xs text-neutral-500">
        PayPal no admite precios en COP (sin conversión automática) — usá una moneda distinta a COP si querés
        ofrecer PayPal para este precio nuevo.
      </p>
      <form className="mt-2 flex items-end gap-2" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label className="block text-xs font-medium">Monto (centavos)</label>
          <input className="mt-1 w-32 rounded border px-2 py-1 text-sm" type="number" {...register("amount")} />
        </div>
        <div>
          <label className="block text-xs font-medium">Moneda</label>
          <input className="mt-1 w-20 rounded border px-2 py-1 text-sm" {...register("currency")} />
        </div>
        <div>
          <label className="block text-xs font-medium">Tipo</label>
          <select className="mt-1 rounded border px-2 py-1 text-sm" {...register("interval")}>
            <option value="ONE_TIME">Pago único</option>
            <option value="RECURRING">Recurrente</option>
          </select>
        </div>
        <button
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          type="submit"
          disabled={isSubmitting}
        >
          Agregar
        </button>
      </form>
      {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>}
    </section>
  );
}
