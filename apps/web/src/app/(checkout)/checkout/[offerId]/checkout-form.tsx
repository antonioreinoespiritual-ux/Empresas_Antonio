"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { startCheckoutAction } from "./actions";
import { openWompiWidget } from "@/lib/wompi-widget";
import { isProviderCompatibleWithCurrency, type PaymentProviderType } from "@repo/core/domain";

const schema = z.object({
  guestEmail: z.string().email(),
  priceId: z.string().min(1),
  provider: z.enum(["WOMPI", "PAYPAL"]),
});

type FormValues = z.infer<typeof schema>;

interface PriceOption {
  id: string;
  amount: number;
  currency: string;
  interval: string;
}

const PROVIDER_LABELS: Record<PaymentProviderType, string> = {
  WOMPI: "Pagar con tarjeta mediante Wompi",
  PAYPAL: "Pagar con PayPal",
};

export function CheckoutForm({ offerId, prices }: { offerId: string; prices: PriceOption[] }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priceId: prices[0]?.id, provider: "WOMPI" },
  });

  const selectedPriceId = watch("priceId");
  const selectedProvider = watch("provider");

  const selectedPrice = prices.find((price) => price.id === selectedPriceId) ?? prices[0];

  const availableProviders = useMemo<PaymentProviderType[]>(() => {
    if (!selectedPrice) return ["WOMPI", "PAYPAL"];
    return (["WOMPI", "PAYPAL"] as const).filter((provider) =>
      isProviderCompatibleWithCurrency(provider, selectedPrice.currency)
    );
  }, [selectedPrice]);

  // Si el comprador cambia a un Price cuya moneda no admite el proveedor ya
  // seleccionado (p. ej. PayPal + COP), forzamos la selección a uno compatible
  // en vez de dejar el formulario en un estado que el servidor rechazaría.
  useEffect(() => {
    if (!availableProviders.includes(selectedProvider) && availableProviders[0]) {
      setValue("provider", availableProviders[0]);
    }
  }, [availableProviders, selectedProvider, setValue]);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const result = await startCheckoutAction({ offerId, ...values });
    if (!result.ok || !result.checkoutSessionId) {
      setServerError(result.error ?? "No se pudo iniciar el checkout");
      return;
    }

    if (result.provider === "WOMPI" && result.clientPayload) {
      try {
        await openWompiWidget({
          publicKey: String(result.clientPayload.publicKey),
          currency: String(result.clientPayload.currency),
          amountInCents: Number(result.clientPayload.amountInCents),
          reference: String(result.clientPayload.reference),
          signature: String(result.clientPayload.signature),
        });
      } catch (error) {
        setServerError(error instanceof Error ? error.message : "No se pudo abrir el widget de pago");
        return;
      }
      // El resultado del widget es solo informativo (ADR-011) — la página de
      // gracias consulta el estado real, que llega por webhook.
      window.location.href = `/gracias/${result.checkoutSessionId}`;
      return;
    }

    if (result.provider === "PAYPAL" && result.clientPayload?.approveUrl) {
      // Checkout estándar de PayPal: el comprador aprueba en una página
      // hospedada por PayPal y vuelve a /api/paypal/return, que dispara el
      // capture real. Nunca Card Fields (ver ADR y notas de elegibilidad).
      window.location.href = String(result.clientPayload.approveUrl);
      return;
    }

    window.location.href = `/gracias/${result.checkoutSessionId}`;
  }

  return (
    <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input className="mt-1 w-full rounded border px-3 py-2" type="email" {...register("guestEmail")} />
        {errors.guestEmail && <p className="mt-1 text-sm text-red-600">{errors.guestEmail.message}</p>}
      </div>

      {prices.length > 1 && (
        <fieldset>
          <legend className="text-sm font-medium">Precio</legend>
          {prices.map((price) => (
            <label key={price.id} className="mt-1 flex items-center gap-2 text-sm">
              <input type="radio" value={price.id} {...register("priceId")} />
              {(price.amount / 100).toLocaleString("es-CO", { style: "currency", currency: price.currency })} (
              {price.interval})
            </label>
          ))}
        </fieldset>
      )}

      <fieldset>
        <legend className="text-sm font-medium">Método de pago</legend>
        {availableProviders.map((provider) => (
          <label key={provider} className="mt-1 flex items-center gap-2 text-sm">
            <input type="radio" value={provider} {...register("provider")} />
            {PROVIDER_LABELS[provider]}
          </label>
        ))}
        {selectedPrice && !isProviderCompatibleWithCurrency("PAYPAL", selectedPrice.currency) && (
          <p className="mt-1 text-xs text-neutral-500">PayPal no está disponible para precios en COP.</p>
        )}
      </fieldset>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <button
        className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        type="submit"
        disabled={isSubmitting}
      >
        Continuar
      </button>
    </form>
  );
}
