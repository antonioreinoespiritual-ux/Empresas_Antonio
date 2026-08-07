import Link from "next/link";
import { commerce } from "@/lib/commerce";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
};

export default async function OrdersPage() {
  const orders = await commerce.orders.list();

  return (
    <main>
      <h1 className="text-2xl font-semibold">Pedidos</h1>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-neutral-500">
            <th className="py-2">Cliente</th>
            <th>Oferta</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Fecha</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b">
              <td className="py-2">{order.customerEmail}</td>
              <td>{order.offerName}</td>
              <td>
                {(order.totalAmount / 100).toLocaleString("es-CO", {
                  style: "currency",
                  currency: order.currency,
                })}
              </td>
              <td>{STATUS_LABEL[order.status] ?? order.status}</td>
              <td>{order.createdAt.toLocaleDateString("es-CO")}</td>
              <td className="text-right">
                <Link className="underline" href={`/orders/${order.id}`}>
                  Ver
                </Link>
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td className="py-4 text-neutral-500" colSpan={6}>
                Todavía no hay pedidos.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
