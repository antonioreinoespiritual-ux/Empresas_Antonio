import { notFound } from "next/navigation";
import { commerce } from "@/lib/commerce";
import { CheckoutForm } from "./checkout-form";

interface CheckoutContent {
  headline?: string;
  subheadline?: string;
}

export default async function CheckoutPage({ params }: { params: { offerId: string } }) {
  const offer = await commerce.offers.findById(params.offerId);
  if (!offer) {
    notFound();
  }

  const page = await commerce.pages.findByOfferAndKind(offer.id, "CHECKOUT");
  const content = page?.status === "PUBLISHED" ? (page.content as CheckoutContent) : null;

  return (
    <main className="py-16">
      <h1 className="text-2xl font-semibold">{content?.headline || offer.name}</h1>
      {content?.subheadline && <p className="mt-2 text-neutral-600">{content.subheadline}</p>}
      <CheckoutForm offerId={offer.id} prices={offer.prices} />
    </main>
  );
}
