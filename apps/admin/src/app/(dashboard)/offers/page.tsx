import { commerce } from "@/lib/commerce";
import { PageHeader, Table, TableHeadCell, TableRow, TableCell, EmptyState, Button } from "@repo/admin-ui/primitives";
import { ActiveToggle } from "./active-toggle";

export default async function OffersPage() {
  const offers = await commerce.offers.list();

  return (
    <div>
      <PageHeader
        title="Ofertas"
        description="Productos empaquetados con precio, listos para vender."
        actions={<Button href="/offers/new">+ Nueva oferta</Button>}
      />

      {offers.length === 0 ? (
        <EmptyState
          title="Todavía no hay ofertas"
          description="Crea la primera oferta para poder venderla desde una landing o checkout."
          action={<Button href="/offers/new">+ Nueva oferta</Button>}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <TableHeadCell className="w-[26%]">Oferta</TableHeadCell>
              <TableHeadCell className="w-[22%]">Producto</TableHeadCell>
              <TableHeadCell className="w-[18%]">Precios</TableHeadCell>
              <TableHeadCell className="w-[16%]">Estado</TableHeadCell>
              <TableHeadCell className="w-[18%]" />
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => (
              <TableRow key={offer.id}>
                <TableCell className="break-words font-medium">{offer.name}</TableCell>
                <TableCell className="break-words text-ink-muted">{offer.productName}</TableCell>
                <TableCell className="break-words tabular-nums">
                  {offer.prices.map((price) => (
                    <div key={price.id}>
                      {(price.amount / 100).toLocaleString("es-CO", { style: "currency", currency: price.currency })} (
                      {price.interval})
                    </div>
                  ))}
                  {offer.prices.length === 0 && <span className="text-ink-faint">Sin precios</span>}
                </TableCell>
                <TableCell>
                  <ActiveToggle offerId={offer.id} isActive={offer.isActive} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button href={`/offers/${offer.id}/edit`} variant="ghost" size="sm">
                      Editar
                    </Button>
                    <Button href={`/offers/${offer.id}/pages`} variant="ghost" size="sm">
                      Páginas
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
