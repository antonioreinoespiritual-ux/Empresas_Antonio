import { commerce } from "@/lib/commerce";
import { PageHeader } from "@repo/admin-ui/primitives";
import { OfferForm } from "../offer-form";

export default async function NewOfferPage() {
  const products = await commerce.products.list();

  return (
    <div>
      <PageHeader title="Nueva oferta" />
      <OfferForm products={products.map((product) => ({ id: product.id, name: product.name }))} />
    </div>
  );
}
