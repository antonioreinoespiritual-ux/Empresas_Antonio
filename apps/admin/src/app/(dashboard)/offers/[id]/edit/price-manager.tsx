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
import { Button, Card, Checkbox, ConfirmDialog, Field, Input, Select, StatusPill, useToast } from "@repo/admin-ui/primitives";
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
  const { show } = useToast();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
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
    const result = await addPriceAction(offerId, {
      amount: values.amount,
      currency: values.currency,
      interval: values.interval,
      enabledProviders,
    });
    if (!result.ok) {
      setAddError(result.error ?? "No se pudo agregar el precio");
      return;
    }
    reset(DEFAULT_VALUES);
    show("Precio agregado");
  }

  async function onConfirmRemove() {
    if (!confirmingId) return;
    setRemovingId(confirmingId);
    const result = await removePriceAction(offerId, confirmingId);
    setRemovingId(null);
    setConfirmingId(null);
    show(result.ok ? "Precio eliminado" : result.error ?? "No se pudo quitar el precio", result.ok ? "success" : "danger");
  }

  return (
    <section className="mt-8 max-w-xl">
      <h2 className="text-base font-semibold text-ink">Precios</h2>
      <div className="mt-2 flex flex-col gap-2">
        {prices.map((price) => {
          const available = getAvailableProviders(price.currency, price.enabledProviders);
          const isRestricted = price.enabledProviders !== null;
          return (
            <Card key={price.id} className="flex items-center justify-between p-3">
              <div className="text-sm text-ink">
                <span className="font-medium tabular-nums">
                  {(price.amount / 100).toLocaleString("es-CO", {
                    style: "currency",
                    currency: price.currency,
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </span>{" "}
                <span className="text-ink-muted">
                  ({price.interval}) — {available.map((p) => PROVIDER_LABELS[p]).join(" + ") || "sin proveedores"}
                </span>
                {isRestricted && (
                  <StatusPill tone="neutral" className="ml-2">
                    Restringido
                  </StatusPill>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={removingId === price.id}
                onClick={() => setConfirmingId(price.id)}
              >
                Quitar
              </Button>
            </Card>
          );
        })}
        {prices.length === 0 && <p className="text-sm text-ink-muted">Sin precios todavía.</p>}
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        PayPal no admite precios en COP (sin conversión automática) — usá una moneda distinta a COP si querés
        ofrecer PayPal para este precio nuevo. Podés además desmarcar un proveedor compatible si no querés
        ofrecerlo para este precio en particular.
      </p>
      <Card className="mt-2 p-3">
        <form className="flex flex-wrap items-end gap-3" onSubmit={handleSubmit(onSubmit)}>
          <div className="w-32">
            <Field label="Monto (centavos)">
              <Input type="number" {...register("amount")} />
            </Field>
          </div>
          <div className="w-20">
            <Field label="Moneda">
              <Input {...register("currency")} />
            </Field>
          </div>
          <div>
            <Field label="Tipo">
              <Select {...register("interval")}>
                <option value="ONE_TIME">Pago único</option>
                <option value="RECURRING">Recurrente</option>
              </Select>
            </Field>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-muted">
            {ALL_PAYMENT_PROVIDERS.map((provider) => {
              const isCompatible = compatible.includes(provider);
              return (
                <label key={provider} className={`flex items-center gap-1.5 ${isCompatible ? "" : "opacity-40"}`}>
                  <Checkbox disabled={!isCompatible} {...register(`enabled.${provider}`)} />
                  {PROVIDER_LABELS[provider]}
                </label>
              );
            })}
          </div>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            Agregar
          </Button>
        </form>
        {errors.amount && <p className="mt-2 text-sm text-danger">{errors.amount.message}</p>}
        {addError && <p className="mt-2 text-sm text-danger">{addError}</p>}
      </Card>

      <ConfirmDialog
        open={confirmingId !== null}
        title="¿Quitar este precio?"
        description="Esta acción borra el precio de forma permanente. Si ya se usó en algún pedido, la operación se rechaza automáticamente."
        confirmLabel="Quitar precio"
        isLoading={removingId !== null}
        onConfirm={onConfirmRemove}
        onCancel={() => setConfirmingId(null)}
      />
    </section>
  );
}
