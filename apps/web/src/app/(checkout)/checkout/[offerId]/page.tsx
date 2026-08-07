import { notFound } from "next/navigation";
import { commerce } from "@/lib/commerce";
import { CheckoutForm } from "./checkout-form";

export default async function CheckoutPage({ params }: { params: { offerId: string } }) {
  const offer = await commerce.offers.findById(params.offerId);
  if (!offer) {
    notFound();
  }

  return (
    <main className="py-16">
      <h1 className="text-2xl font-semibold">{offer.name}</h1>
      <CheckoutForm offerId={offer.id} prices={offer.prices} />
    </main>
  );
}
