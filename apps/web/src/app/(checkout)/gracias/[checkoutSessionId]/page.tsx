export default function ThankYouPage({ params }: { params: { checkoutSessionId: string } }) {
  return (
    <main className="py-16">
      <h1 className="text-2xl font-semibold">¡Gracias por tu compra!</h1>
      <p className="mt-4 text-neutral-600">
        Esta página solo lee el estado de la Order asociada a {params.checkoutSessionId} — la
        confirmación real llega por webhook (Fase 1), nunca desde el navegador.
      </p>
    </main>
  );
}
