import { notFound } from "next/navigation";
import { commerce } from "@/lib/commerce";

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  DECLINED: "Rechazado",
  FAILED: "Fallido",
  REFUNDED: "Reembolsado",
  PARTIALLY_REFUNDED: "Reembolso parcial",
};

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = await commerce.orders.findDetailById(params.id);
  if (!order) {
    notFound();
  }

  return (
    <main className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Pedido #{order.id.slice(0, 8)}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Cliente: {order.customerEmail} · Estado: {ORDER_STATUS_LABEL[order.status] ?? order.status}
      </p>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Artículos</h2>
        <ul className="mt-2 divide-y text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="py-2">
              {item.offerName} —{" "}
              {(item.amountSnapshot / 100).toLocaleString("es-CO", {
                style: "currency",
                currency: item.currencySnapshot,
              })}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Pagos</h2>
        <ul className="mt-2 divide-y text-sm">
          {order.payments.map((payment) => (
            <li key={payment.id} className="py-2">
              {payment.provider} · {payment.providerReference} · {PAYMENT_STATUS_LABEL[payment.status] ?? payment.status} ·{" "}
              {(payment.amount / 100).toLocaleString("es-CO", { style: "currency", currency: payment.currency })}
            </li>
          ))}
          {order.payments.length === 0 && (
            <li className="py-2 text-neutral-500">Sin pagos registrados todavía.</li>
          )}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-medium">Accesos otorgados</h2>
        <ul className="mt-2 divide-y text-sm">
          {order.entitlements.map((entitlement) => (
            <li key={entitlement.id} className="py-2">
              {entitlement.productName} — {entitlement.status}
            </li>
          ))}
          {order.entitlements.length === 0 && (
            <li className="py-2 text-neutral-500">Sin accesos otorgados todavía.</li>
          )}
        </ul>
      </section>
    </main>
  );
}
