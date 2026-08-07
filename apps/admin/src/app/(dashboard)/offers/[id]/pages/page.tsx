import { notFound } from "next/navigation";
import { commerce } from "@/lib/commerce";
import { LandingPageForm } from "./landing-page-form";
import { CheckoutPageForm } from "./checkout-page-form";
import { ThankYouPageForm } from "./thank-you-page-form";

export default async function OfferPagesPage({ params }: { params: { id: string } }) {
  const offer = await commerce.offers.findById(params.id);
  if (!offer) {
    notFound();
  }

  const [landing, checkout, thankYou] = await Promise.all([
    commerce.pages.findByOfferAndKind(offer.id, "LANDING"),
    commerce.pages.findByOfferAndKind(offer.id, "CHECKOUT"),
    commerce.pages.findByOfferAndKind(offer.id, "THANK_YOU"),
  ]);

  return (
    <main className="flex max-w-2xl flex-col gap-8">
      <h1 className="text-2xl font-semibold">Páginas de {offer.name}</h1>
      <LandingPageForm offerId={offer.id} page={landing} />
      <CheckoutPageForm offerId={offer.id} page={checkout} />
      <ThankYouPageForm offerId={offer.id} page={thankYou} />
    </main>
  );
}
