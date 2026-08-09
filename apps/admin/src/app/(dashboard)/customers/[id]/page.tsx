import { notFound } from "next/navigation";
import { commerce } from "@/lib/commerce";
import { Button, Card, PageHeader, StatusPill } from "@repo/admin-ui/primitives";

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
};

const ORDER_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  PENDING: "warning",
  PAID: "success",
  CANCELLED: "danger",
};

const ENTITLEMENT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activo",
  REVOKED: "Revocado",
  EXPIRED: "Expirado",
};

const ENTITLEMENT_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  REVOKED: "danger",
  EXPIRED: "neutral",
};

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const customer = await commerce.customers.findDetailById(params.id);
  if (!customer) {
    notFound();
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={customer.email}
        description={`${customer.name ?? "Sin nombre"} · ${customer.userId ? "Con cuenta" : "Invitado (sin cuenta)"}`}
      />

      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="text-base font-semibold text-ink">Pedidos</h2>
          <ul className="mt-2 divide-y divide-border text-sm">
            {customer.orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-ink">{order.offerName}</span>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusPill tone={ORDER_STATUS_TONE[order.status] ?? "neutral"}>
                    {ORDER_STATUS_LABEL[order.status] ?? order.status}
                  </StatusPill>
                  <Button href={`/orders/${order.id}`} variant="ghost" size="sm">
                    Ver
                  </Button>
                </div>
              </li>
            ))}
            {customer.orders.length === 0 && <li className="py-2 text-ink-muted">Sin pedidos todavía.</li>}
          </ul>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-ink">Accesos</h2>
          <ul className="mt-2 divide-y divide-border text-sm">
            {customer.entitlements.map((entitlement) => (
              <li key={entitlement.id} className="flex items-center justify-between py-2">
                <span className="text-ink">{entitlement.productName}</span>
                <StatusPill tone={ENTITLEMENT_STATUS_TONE[entitlement.status] ?? "neutral"}>
                  {ENTITLEMENT_STATUS_LABEL[entitlement.status] ?? entitlement.status}
                </StatusPill>
              </li>
            ))}
            {customer.entitlements.length === 0 && (
              <li className="py-2 text-ink-muted">Sin accesos otorgados todavía.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
