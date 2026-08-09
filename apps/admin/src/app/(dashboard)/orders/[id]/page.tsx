import { notFound } from "next/navigation";
import { commerce } from "@/lib/commerce";
import { Card, PageHeader, StatusPill } from "@repo/admin-ui/primitives";

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

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  DECLINED: "Rechazado",
  FAILED: "Fallido",
  REFUNDED: "Reembolsado",
  PARTIALLY_REFUNDED: "Reembolso parcial",
};

const PAYMENT_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  PENDING: "warning",
  APPROVED: "success",
  DECLINED: "danger",
  FAILED: "danger",
  REFUNDED: "neutral",
  PARTIALLY_REFUNDED: "warning",
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

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = await commerce.orders.findDetailById(params.id);
  if (!order) {
    notFound();
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Pedido #${order.id.slice(0, 8)}`}
        description={`Cliente: ${order.customerEmail}`}
        actions={
          <StatusPill tone={ORDER_STATUS_TONE[order.status] ?? "neutral"}>
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
          </StatusPill>
        }
      />

      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="text-base font-semibold text-ink">Artículos</h2>
          <ul className="mt-2 divide-y divide-border text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2">
                <span className="text-ink">{item.offerName}</span>
                <span className="tabular-nums text-ink-muted">
                  {(item.amountSnapshot / 100).toLocaleString("es-CO", {
                    style: "currency",
                    currency: item.currencySnapshot,
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-ink">Pagos</h2>
          <ul className="mt-2 divide-y divide-border text-sm">
            {order.payments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-ink-muted">
                  {payment.provider} · {payment.providerReference}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="tabular-nums text-ink">
                    {(payment.amount / 100).toLocaleString("es-CO", {
                      style: "currency",
                      currency: payment.currency,
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <StatusPill tone={PAYMENT_STATUS_TONE[payment.status] ?? "neutral"}>
                    {PAYMENT_STATUS_LABEL[payment.status] ?? payment.status}
                  </StatusPill>
                </div>
              </li>
            ))}
            {order.payments.length === 0 && <li className="py-2 text-ink-muted">Sin pagos registrados todavía.</li>}
          </ul>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-ink">Accesos otorgados</h2>
          <ul className="mt-2 divide-y divide-border text-sm">
            {order.entitlements.map((entitlement) => (
              <li key={entitlement.id} className="flex items-center justify-between py-2">
                <span className="text-ink">{entitlement.productName}</span>
                <StatusPill tone={ENTITLEMENT_STATUS_TONE[entitlement.status] ?? "neutral"}>
                  {ENTITLEMENT_STATUS_LABEL[entitlement.status] ?? entitlement.status}
                </StatusPill>
              </li>
            ))}
            {order.entitlements.length === 0 && (
              <li className="py-2 text-ink-muted">Sin accesos otorgados todavía.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
