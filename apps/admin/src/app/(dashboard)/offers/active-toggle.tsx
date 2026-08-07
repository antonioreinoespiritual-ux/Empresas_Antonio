"use client";

import { useState } from "react";
import { setOfferActiveAction } from "./actions";

export function ActiveToggle({ offerId, isActive }: { offerId: string; isActive: boolean }) {
  const [isPending, setPending] = useState(false);

  return (
    <button
      type="button"
      className="rounded border px-2 py-1 text-xs disabled:opacity-50"
      disabled={isPending}
      onClick={async () => {
        setPending(true);
        await setOfferActiveAction(offerId, !isActive);
        setPending(false);
      }}
    >
      {isActive ? "Activa" : "Inactiva"}
    </button>
  );
}
