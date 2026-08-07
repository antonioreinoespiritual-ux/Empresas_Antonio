export default function CheckoutPage({ params }: { params: { offerId: string } }) {
  return (
    <main className="py-16">
      <h1 className="text-2xl font-semibold">Checkout — Offer {params.offerId}</h1>
      <p className="mt-4 text-neutral-600">
        Selección de proveedor (Wompi / PayPal) pendiente de Fase 1.
      </p>
    </main>
  );
}
