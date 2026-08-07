"use server";

import { prepareCheckoutPayment, startCheckout } from "@repo/core/application";
import type { PaymentProviderType } from "@repo/core/domain";
import { commerce } from "@/lib/commerce";

export interface StartCheckoutFormResult {
  ok: boolean;
  error?: string;
  checkoutSessionId?: string;
}

export async function startCheckoutAction(input: {
  offerId: string;
  priceId: string;
  guestEmail: string;
  provider: PaymentProviderType;
}): Promise<StartCheckoutFormResult> {
  try {
    const session = await startCheckout(commerce, {
      offerId: input.offerId,
      priceId: input.priceId,
      guestEmail: input.guestEmail,
    });

    await prepareCheckoutPayment(commerce, {
      checkoutSessionId: session.id,
      provider: input.provider,
    });

    return { ok: true, checkoutSessionId: session.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}
