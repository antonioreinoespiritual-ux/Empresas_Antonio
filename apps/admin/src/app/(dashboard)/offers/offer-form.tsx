"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  ALL_PAYMENT_PROVIDERS,
  compatibleProviders,
  DEFAULT_THEME_ID,
  THEME_IDS,
  type PaymentProviderType,
  type ThemeId,
} from "@repo/core/domain";
import { createOfferAction } from "./actions";

const PROVIDER_LABELS: Record<PaymentProviderType, string> = { WOMPI: "Wompi", PAYPAL: "PayPal" };
const THEME_LABELS: Record<ThemeId, string> = {
  "premium-light": "Premium Light",
  "premium-dark": "Premium Dark",
  editorial: "Editorial",
  "high-conversion": "High Conversion",
};

const priceSchema = z.object({
  amount: z.coerce.number().int().positive(),
  currency: z.string().length(3),
  interval: z.enum(["ONE_TIME", "RECURRING"]),
  // .default(false): un checkbox deshabilitado (proveedor no compatible con
  // la moneda) queda fuera de los valores que react-hook-form envía en el
  // submit — sin el default, Zod lo rechazaría como campo faltante y
  // bloquearía la creación de cualquier oferta cuya moneda por defecto (COP)
  // deshabilite PayPal.
  enabled: z.object({ WOMPI: z.boolean().default(false), PAYPAL: z.boolean().default(false) }),
});

const schema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  themeId: z.enum(THEME_IDS),
  prices: z.array(priceSchema).min(1),
});

type FormValues = z.infer<typeof schema>;

export function OfferForm({ products }: { products: { id: string; name: string }[] }) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
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
      themeId: DEFAULT_THEME_ID,
      prices: [{ amount: 0, currency: "COP", interval: "ONE_TIME", enabled: { WOMPI: true, PAYPAL: true } }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "prices" });
  const watchedPrices = useWatch({ control, name: "prices" });

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    const prices = values.prices.map(({ enabled, ...price }) => {
      const compatible = compatibleProviders(price.currency.toUpperCase());
      const checked = ALL_PAYMENT_PROVIDERS.filter((provider) => enabled[provider] && compatible.includes(provider));
      // Si quedaron marcados todos los compatibles, no es una restricción
      // real del admin — se guarda null ("todos") para no quedar
      // desactualizado si en el futuro se agrega un proveedor nuevo.
      const enabledProviders = checked.length === compatible.length ? null : checked;
      return { ...price, enabledProviders, checkedCount: checked.length };
    });
    if (prices.some((price) => price.checkedCount === 0)) {
      setSubmitError("Cada precio necesita al menos un proveedor de pago habilitado.");
      return;
    }
    await createOfferAction({
      productId: values.productId,
      name: values.name,
      themeId: values.themeId,
      prices: prices.map(({ checkedCount, ...price }) => price),
    });
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

      <div>
        <label className="block text-sm font-medium">Theme (piel visual de la landing/checkout)</label>
        <select className="mt-1 w-full rounded border px-3 py-2" {...register("themeId")}>
          {THEME_IDS.map((id) => (
            <option key={id} value={id}>
              {THEME_LABELS[id]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="rounded border p-4">
        <legend className="text-sm font-medium">Precios</legend>
        <p className="text-xs text-neutral-500">
          La moneda define qué proveedores son técnicamente compatibles (PayPal no admite COP, sin conversión
          automática). Podés además desmarcar un proveedor compatible si no querés ofrecerlo para este precio en
          particular.
        </p>
        {fields.map((field, index) => {
          const currency = (watchedPrices?.[index]?.currency || "").toUpperCase();
          const compatible = compatibleProviders(currency);
          return (
            <div key={field.id} className="mt-3 rounded border border-neutral-200 p-2">
              <div className="flex items-center gap-2">
                <input
                  className="w-32 rounded border px-2 py-1"
                  type="number"
                  placeholder="Monto (centavos)"
                  {...register(`prices.${index}.amount`)}
                />
                <input
                  className="w-20 rounded border px-2 py-1"
                  placeholder="COP"
                  {...register(`prices.${index}.currency`)}
                />
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
              <div className="mt-2 flex items-center gap-3 text-xs text-neutral-600">
                <span className="font-medium">Proveedores:</span>
                {ALL_PAYMENT_PROVIDERS.map((provider) => {
                  const isCompatible = compatible.includes(provider);
                  return (
                    <label key={provider} className={`flex items-center gap-1 ${isCompatible ? "" : "opacity-40"}`}>
                      <input type="checkbox" disabled={!isCompatible} {...register(`prices.${index}.enabled.${provider}`)} />
                      {PROVIDER_LABELS[provider]}
                      {!isCompatible && " (no compatible)"}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
        <button
          type="button"
          className="mt-2 text-sm underline"
          onClick={() =>
            append({ amount: 0, currency: "COP", interval: "ONE_TIME", enabled: { WOMPI: true, PAYPAL: true } })
          }
        >
          + Agregar precio
        </button>
        {errors.prices && <p className="mt-1 text-sm text-red-600">Revisa los precios ingresados</p>}
      </fieldset>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

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
