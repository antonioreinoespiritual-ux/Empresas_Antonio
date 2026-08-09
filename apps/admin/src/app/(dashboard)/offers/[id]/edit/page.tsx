import { notFound } from "next/navigation";
import { commerce } from "@/lib/commerce";
import { Button, PageHeader } from "@repo/admin-ui/primitives";
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
    <div>
      <PageHeader
        title="Editar oferta"
        actions={
          <>
            <ActiveToggle offerId={offer.id} isActive={offer.isActive} />
            <Button href={`/offers/${offer.id}/pages`} variant="secondary" size="sm">
              Editar páginas
            </Button>
          </>
        }
      />
      <EditOfferNameForm offerId={offer.id} defaultName={offer.name} />
      <EditOfferThemeForm offerId={offer.id} defaultThemeId={offer.themeId} />
      <PriceManager offerId={offer.id} prices={offer.prices} />
    </div>
  );
}
