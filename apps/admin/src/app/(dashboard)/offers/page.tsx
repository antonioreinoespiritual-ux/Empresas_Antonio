import Link from "next/link";
import { commerce } from "@/lib/commerce";
import { ActiveToggle } from "./active-toggle";

export default async function OffersPage() {
  const offers = await commerce.offers.list();

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ofertas</h1>
        <Link className="rounded bg-neutral-900 px-4 py-2 text-sm text-white" href="/offers/new">
          Nueva oferta
        </Link>
      </div>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-neutral-500">
            <th className="py-2">Oferta</th>
            <th>Producto</th>
            <th>Precios</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {offers.map((offer) => (
            <tr key={offer.id} className="border-b align-top">
              <td className="py-2">{offer.name}</td>
              <td>{offer.productName}</td>
              <td>
                {offer.prices.map((price) => (
                  <div key={price.id}>
                    {(price.amount / 100).toLocaleString("es-CO", {
                      style: "currency",
                      currency: price.currency,
                    })}{" "}
                    ({price.interval})
                  </div>
                ))}
                {offer.prices.length === 0 && <span className="text-neutral-400">Sin precios</span>}
              </td>
              <td>
                <ActiveToggle offerId={offer.id} isActive={offer.isActive} />
              </td>
              <td className="space-x-3 text-right">
                <Link className="underline" href={`/offers/${offer.id}/edit`}>
                  Editar
                </Link>
                <Link className="underline" href={`/offers/${offer.id}/pages`}>
                  Páginas
                </Link>
              </td>
            </tr>
          ))}
          {offers.length === 0 && (
            <tr>
              <td className="py-4 text-neutral-500" colSpan={5}>
                Todavía no hay ofertas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
