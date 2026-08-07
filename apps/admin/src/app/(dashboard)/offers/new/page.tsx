import { commerce } from "@/lib/commerce";
import { OfferForm } from "../offer-form";

export default async function NewOfferPage() {
  const products = await commerce.products.list();

  return (
    <main>
      <h1 className="text-2xl font-semibold">Nueva oferta</h1>
      <OfferForm products={products.map((product) => ({ id: product.id, name: product.name }))} />
    </main>
  );
}
