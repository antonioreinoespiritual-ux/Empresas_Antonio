import { commerce } from "@/lib/commerce";
import { PageHeader, Table, TableHeadCell, TableRow, TableCell, EmptyState, StatusPill, Button } from "@repo/admin-ui/primitives";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  PENDING: "warning",
  PAID: "success",
  CANCELLED: "danger",
};

export default async function OrdersPage() {
  const orders = await commerce.orders.list();

  return (
    <div>
      <PageHeader title="Pedidos" description="Compras iniciadas por clientes, con su estado de pago." />

      {orders.length === 0 ? (
        <EmptyState title="Todavía no hay pedidos" description="Los pedidos aparecerán acá en cuanto alguien inicie un checkout." />
      ) : (
        <Table>
          <thead>
            <tr>
              <TableHeadCell>Cliente</TableHeadCell>
              <TableHeadCell>Oferta</TableHeadCell>
              <TableHeadCell>Total</TableHeadCell>
              <TableHeadCell>Estado</TableHeadCell>
              <TableHeadCell>Fecha</TableHeadCell>
              <TableHeadCell />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.customerEmail}</TableCell>
                <TableCell className="text-ink-muted">{order.offerName}</TableCell>
                <TableCell className="tabular-nums">
                  {(order.totalAmount / 100).toLocaleString("es-CO", { style: "currency", currency: order.currency })}
                </TableCell>
                <TableCell>
                  <StatusPill tone={STATUS_TONE[order.status] ?? "neutral"}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </StatusPill>
                </TableCell>
                <TableCell className="tabular-nums text-ink-muted">{order.createdAt.toLocaleDateString("es-CO")}</TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button href={`/orders/${order.id}`} variant="ghost" size="sm">
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
