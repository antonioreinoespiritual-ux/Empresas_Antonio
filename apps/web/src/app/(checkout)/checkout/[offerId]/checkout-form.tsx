"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Card, FormField, Stack, Text } from "@repo/ui/primitives";
import type { Theme } from "@repo/ui/themes";
import { startCheckoutAction } from "./actions";
import { openWompiWidget } from "@/lib/wompi-widget";
import { getAvailableProviders, isProviderCompatibleWithCurrency, type PaymentProviderType } from "@repo/core/domain";

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
  enabledProviders: PaymentProviderType[] | null;
}

const PROVIDER_LABELS: Record<PaymentProviderType, string> = {
  WOMPI: "Pagar con tarjeta mediante Wompi",
  PAYPAL: "Pagar con PayPal",
};

export function CheckoutForm({
  offerId,
  prices,
  buttonPreset,
  cardPreset,
}: {
  offerId: string;
  prices: PriceOption[];
  buttonPreset: Theme["buttonPreset"];
  cardPreset: Theme["cardPreset"];
}) {
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
    return getAvailableProviders(selectedPrice.currency, selectedPrice.enabledProviders);
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
    <Card cardPreset={cardPreset} className="mt-6">
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack gap="md">
          <FormField
            label="Email"
            type="email"
            error={errors.guestEmail?.message}
            {...register("guestEmail")}
          />

          {prices.length > 1 && (
            <fieldset>
              <legend className="text-sm font-medium text-foreground">Precio</legend>
              <Stack gap="xs" className="mt-1.5">
                {prices.map((price) => (
                  <label key={price.id} className="flex items-center gap-2 text-sm text-foreground">
                    <input type="radio" className="accent-primary" value={price.id} {...register("priceId")} />
                    {(price.amount / 100).toLocaleString("es-CO", { style: "currency", currency: price.currency })} (
                    {price.interval})
                  </label>
                ))}
              </Stack>
            </fieldset>
          )}

          <fieldset>
            <legend className="text-sm font-medium text-foreground">Método de pago</legend>
            <Stack gap="xs" className="mt-1.5">
              {availableProviders.map((provider) => (
                <label key={provider} className="flex items-center gap-2 text-sm text-foreground">
                  <input type="radio" className="accent-primary" value={provider} {...register("provider")} />
                  {PROVIDER_LABELS[provider]}
                </label>
              ))}
            </Stack>
            {selectedPrice && !isProviderCompatibleWithCurrency("PAYPAL", selectedPrice.currency) && (
              <Text size="sm" tone="muted" className="mt-1.5">
                PayPal no está disponible para precios en COP.
              </Text>
            )}
          </fieldset>

          {serverError && (
            <Text size="sm" className="text-destructive">
              {serverError}
            </Text>
          )}

          <Button type="submit" disabled={isSubmitting} buttonPreset={buttonPreset} className="w-full">
            Continuar
          </Button>
        </Stack>
      </form>
    </Card>
  );
}
