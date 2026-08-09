"use client";

import { useEffect, useState } from "react";

export function OrderStatus({ checkoutSessionId }: { checkoutSessionId: string }) {
  const [status, setStatus] = useState<string>("PENDING");

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval>;

    async function poll() {
      const response = await fetch(`/api/checkout-sessions/${checkoutSessionId}/status`);
      const data = (await response.json()) as { status: string };
      if (cancelled) return;
      setStatus(data.status);
      if (data.status !== "PENDING") {
        clearInterval(interval);
      }
    }

    poll();
    interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [checkoutSessionId]);

  if (status === "PAID") {
    return <p className="mt-4 font-medium text-success">¡Pago confirmado!</p>;
  }
  if (status === "CANCELLED") {
    return <p className="mt-4 font-medium text-destructive">El pago no se pudo procesar.</p>;
  }
  return <p className="mt-4 text-foreground-muted">Procesando tu pago…</p>;
}
