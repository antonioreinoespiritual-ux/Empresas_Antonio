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
import { Button, Card, Checkbox, Field, Input, Select, useToast } from "@repo/admin-ui/primitives";
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
  const { show } = useToast();
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
    const result = await createOfferAction({
      productId: values.productId,
      name: values.name,
      themeId: values.themeId,
      prices: prices.map(({ checkedCount, ...price }) => price),
    });
    if (!result.ok) {
      setSubmitError(result.error ?? "No se pudo crear la oferta");
      return;
    }
    show("Oferta creada");
    router.push("/offers");
  }

  return (
    <form className="mt-6 flex max-w-xl flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <Field label="Producto" htmlFor="productId" error={errors.productId?.message}>
        <Select id="productId" invalid={!!errors.productId} {...register("productId")}>
          <option value="">Selecciona un producto</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Nombre de la oferta" htmlFor="name" error={errors.name?.message}>
        <Input id="name" invalid={!!errors.name} {...register("name")} />
      </Field>

      <Field label="Theme (piel visual de la landing/checkout)" htmlFor="themeId">
        <Select id="themeId" {...register("themeId")}>
          {THEME_IDS.map((id) => (
            <option key={id} value={id}>
              {THEME_LABELS[id]}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium text-ink">Precios</legend>
        <p className="text-xs text-ink-muted">
          La moneda define qué proveedores son técnicamente compatibles (PayPal no admite COP, sin conversión
          automática). Podés además desmarcar un proveedor compatible si no querés ofrecerlo para este precio en
          particular.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {fields.map((field, index) => {
            const currency = (watchedPrices?.[index]?.currency || "").toUpperCase();
            const compatible = compatibleProviders(currency);
            return (
              <Card key={field.id} className="p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-32">
                    <Field label="Monto (centavos)" htmlFor={`prices.${index}.amount`}>
                      <Input id={`prices.${index}.amount`} type="number" {...register(`prices.${index}.amount`)} />
                    </Field>
                  </div>
                  <div className="w-20">
                    <Field label="Moneda" htmlFor={`prices.${index}.currency`}>
                      <Input id={`prices.${index}.currency`} placeholder="COP" {...register(`prices.${index}.currency`)} />
                    </Field>
                  </div>
                  <div>
                    <Field label="Tipo" htmlFor={`prices.${index}.interval`}>
                      <Select id={`prices.${index}.interval`} {...register(`prices.${index}.interval`)}>
                        <option value="ONE_TIME">Pago único</option>
                        <option value="RECURRING">Recurrente</option>
                      </Select>
                    </Field>
                  </div>
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                      Quitar
                    </Button>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-ink-muted">
                  <span className="font-medium text-ink">Proveedores:</span>
                  {ALL_PAYMENT_PROVIDERS.map((provider) => {
                    const isCompatible = compatible.includes(provider);
                    return (
                      <label
                        key={provider}
                        className={`flex items-center gap-1.5 ${isCompatible ? "" : "opacity-40"}`}
                      >
                        <Checkbox disabled={!isCompatible} {...register(`prices.${index}.enabled.${provider}`)} />
                        {PROVIDER_LABELS[provider]}
                        {!isCompatible && " (no compatible)"}
                      </label>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() =>
            append({ amount: 0, currency: "COP", interval: "ONE_TIME", enabled: { WOMPI: true, PAYPAL: true } })
          }
        >
          + Agregar precio
        </Button>
        {errors.prices && <p className="mt-2 text-sm text-danger">Revisa los precios ingresados</p>}
      </fieldset>

      {submitError && <p className="text-sm text-danger">{submitError}</p>}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        Crear oferta
      </Button>
    </form>
  );
}
