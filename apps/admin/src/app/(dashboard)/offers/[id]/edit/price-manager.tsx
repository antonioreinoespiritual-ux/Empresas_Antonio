"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  ALL_PAYMENT_PROVIDERS,
  compatibleProviders,
  getAvailableProviders,
  type PaymentProviderType,
  type Price,
} from "@repo/core/domain";
import { addPriceAction, removePriceAction } from "../../actions";

const PROVIDER_LABELS: Record<PaymentProviderType, string> = { WOMPI: "Wompi", PAYPAL: "PayPal" };

const schema = z.object({
  amount: z.coerce.number().int().positive(),
  currency: z.string().length(3),
  interval: z.enum(["ONE_TIME", "RECURRING"]),
  // .default(false): un checkbox deshabilitado (proveedor no compatible con
  // la moneda) queda fuera de los valores que react-hook-form envía en el
  // submit — sin el default, Zod lo rechazaría como campo faltante y
  // bloquearía agregar cualquier precio cuya moneda por defecto (COP)
  // deshabilite PayPal.
  enabled: z.object({ WOMPI: z.boolean().default(false), PAYPAL: z.boolean().default(false) }),
});
type FormValues = z.infer<typeof schema>;

const DEFAULT_VALUES: FormValues = {
  amount: 0,
  currency: "COP",
  interval: "ONE_TIME",
  enabled: { WOMPI: true, PAYPAL: true },
};

export function PriceManager({ offerId, prices }: { offerId: string; prices: Price[] }) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const currency = (useWatch({ control, name: "currency" }) || "").toUpperCase();
  const compatible = compatibleProviders(currency);

  async function onSubmit(values: FormValues) {
    setAddError(null);
    const priceCompatible = compatibleProviders(values.currency.toUpperCase());
    const checked = ALL_PAYMENT_PROVIDERS.filter(
      (provider) => values.enabled[provider] && priceCompatible.includes(provider)
    );
    if (checked.length === 0) {
      setAddError("El precio necesita al menos un proveedor de pago habilitado.");
      return;
    }
    const enabledProviders = checked.length === priceCompatible.length ? null : checked;
    await addPriceAction(offerId, { amount: values.amount, currency: values.currency, interval: values.interval, enabledProviders });
    reset(DEFAULT_VALUES);
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
        {prices.map((price) => {
          const available = getAvailableProviders(price.currency, price.enabledProviders);
          const isRestricted = price.enabledProviders !== null;
          return (
            <li key={price.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {(price.amount / 100).toLocaleString("es-CO", { style: "currency", currency: price.currency })} (
                {price.interval}) — {available.map((p) => PROVIDER_LABELS[p]).join(" + ") || "sin proveedores"}
                {isRestricted && <span className="text-neutral-400"> (restringido por admin)</span>}
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
          );
        })}
        {prices.length === 0 && <li className="py-2 text-sm text-neutral-500">Sin precios todavía.</li>}
      </ul>
      {removeError && <p className="mt-1 text-sm text-red-600">{removeError}</p>}

      <p className="mt-4 text-xs text-neutral-500">
        PayPal no admite precios en COP (sin conversión automática) — usá una moneda distinta a COP si querés
        ofrecer PayPal para este precio nuevo. Podés además desmarcar un proveedor compatible si no querés
        ofrecerlo para este precio en particular.
      </p>
      <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={handleSubmit(onSubmit)}>
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
        <div className="flex items-center gap-3 text-xs text-neutral-600">
          {ALL_PAYMENT_PROVIDERS.map((provider) => {
            const isCompatible = compatible.includes(provider);
            return (
              <label key={provider} className={`flex items-center gap-1 ${isCompatible ? "" : "opacity-40"}`}>
                <input type="checkbox" disabled={!isCompatible} {...register(`enabled.${provider}`)} />
                {PROVIDER_LABELS[provider]}
              </label>
            );
          })}
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
      {addError && <p className="mt-1 text-sm text-red-600">{addError}</p>}
    </section>
  );
}
