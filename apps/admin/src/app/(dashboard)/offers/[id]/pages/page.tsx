import { notFound } from "next/navigation";
import { commerce } from "@/lib/commerce";
import { PageHeader } from "@repo/admin-ui/primitives";
import { LandingPageForm } from "./landing-page-form";
import { LandingBlocksForm } from "./landing-blocks-form";
import { CompositionForm } from "./composition/composition-form";
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
    <div className="max-w-5xl">
      <PageHeader title={`Páginas de ${offer.name}`} />
      <div className="flex flex-col gap-6">
        <CompositionForm offerId={offer.id} page={landing} />
        <LandingPageForm offerId={offer.id} page={landing} />
        <LandingBlocksForm offerId={offer.id} page={landing} />
        <CheckoutPageForm offerId={offer.id} page={checkout} />
        <ThankYouPageForm offerId={offer.id} page={thankYou} />
      </div>
    </div>
  );
}
