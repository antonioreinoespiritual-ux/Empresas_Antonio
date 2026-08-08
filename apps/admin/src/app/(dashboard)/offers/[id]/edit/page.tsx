import { notFound } from "next/navigation";
import Link from "next/link";
import { commerce } from "@/lib/commerce";
import { ActiveToggle } from "../../active-toggle";
import { EditOfferNameForm } from "./edit-offer-name-form";
import { EditOfferThemeForm } from "./edit-offer-theme-form";
import { PriceManager } from "./price-manager";

export default async function EditOfferPage({ params }: { params: { id: string } }) {
  const offer = await commerce.offers.findById(params.id);
  if (!offer) {
    notFound();
  }

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Editar oferta</h1>
        <div className="flex items-center gap-3">
          <ActiveToggle offerId={offer.id} isActive={offer.isActive} />
          <Link className="text-sm underline" href={`/offers/${offer.id}/pages`}>
            Editar páginas
          </Link>
        </div>
      </div>
      <EditOfferNameForm offerId={offer.id} defaultName={offer.name} />
      <EditOfferThemeForm offerId={offer.id} defaultThemeId={offer.themeId} />
      <PriceManager offerId={offer.id} prices={offer.prices} />
    </main>
  );
}
