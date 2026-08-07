import { notFound } from "next/navigation";
import Link from "next/link";
import { commerce } from "@/lib/commerce";

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const customer = await commerce.customers.findDetailById(params.id);
  if (!customer) {
    notFound();
  }

  return (
    <main className="max-w-2xl">
      <h1 className="text-2xl font-semibold">{customer.email}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {customer.name ?? "Sin nombre"} · {customer.userId ? "Con cuenta" : "Invitado (sin cuenta)"}
      </p>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Pedidos</h2>
        <ul className="mt-2 divide-y text-sm">
          {customer.orders.map((order) => (
            <li key={order.id} className="flex items-center justify-between py-2">
              <span>
                {order.offerName} — {order.status}
              </span>
              <Link className="underline" href={`/orders/${order.id}`}>
                Ver
              </Link>
            </li>
          ))}
          {customer.orders.length === 0 && <li className="py-2 text-neutral-500">Sin pedidos todavía.</li>}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Accesos</h2>
        <ul className="mt-2 divide-y text-sm">
          {customer.entitlements.map((entitlement) => (
            <li key={entitlement.id} className="py-2">
              {entitlement.productName} — {entitlement.status}
            </li>
          ))}
          {customer.entitlements.length === 0 && (
            <li className="py-2 text-neutral-500">Sin accesos otorgados todavía.</li>
          )}
        </ul>
      </section>
    </main>
  );
}
