import { commerce } from "@/lib/commerce";
import { PageHeader, Table, TableHeadCell, TableRow, TableCell, EmptyState, StatusPill, Button } from "@repo/admin-ui/primitives";

export default async function CustomersPage() {
  const customers = await commerce.customers.list();

  return (
    <div>
      <PageHeader title="Clientes" description="Compradores, con o sin cuenta creada." />

      {customers.length === 0 ? (
        <EmptyState title="Todavía no hay clientes" description="Los clientes aparecerán acá después de su primera compra." />
      ) : (
        <Table>
          <thead>
            <tr>
              <TableHeadCell>Email</TableHeadCell>
              <TableHeadCell>Nombre</TableHeadCell>
              <TableHeadCell>Cuenta</TableHeadCell>
              <TableHeadCell>Pedidos</TableHeadCell>
              <TableHeadCell />
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">{customer.email}</TableCell>
                <TableCell className="text-ink-muted">{customer.name ?? "—"}</TableCell>
                <TableCell>
                  <StatusPill tone={customer.userId ? "success" : "neutral"}>
                    {customer.userId ? "Con cuenta" : "Invitado"}
                  </StatusPill>
                </TableCell>
                <TableCell className="tabular-nums">{customer.ordersCount}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button href={`/customers/${customer.id}`} variant="ghost" size="sm">
                      Ver
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
