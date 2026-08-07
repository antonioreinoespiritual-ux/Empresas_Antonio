import {
  PrismaCustomerRepository,
  PrismaOfferRepository,
  PrismaCheckoutSessionRepository,
  PrismaOrderRepository,
  PrismaPaymentRepository,
  PrismaEntitlementRepository,
  PrismaWebhookEventRepository,
  PrismaPageRepository,
  WompiPaymentProvider,
  PayPalPaymentProvider,
} from "@repo/core/infrastructure";
import type { PaymentProvider } from "@repo/core/application";
import type { PaymentProviderType } from "@repo/core/domain";

const providers: Record<PaymentProviderType, PaymentProvider> = {
  WOMPI: new WompiPaymentProvider({
    publicKey: process.env.WOMPI_PUBLIC_KEY ?? "",
    integritySecret: process.env.WOMPI_INTEGRITY_SECRET ?? "",
    eventSecret: process.env.WOMPI_EVENT_SECRET ?? "",
  }),
  PAYPAL: new PayPalPaymentProvider({
    clientId: process.env.PAYPAL_CLIENT_ID ?? "",
    clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? "",
    webhookId: process.env.PAYPAL_WEBHOOK_ID ?? "",
  }),
};

// Composition root de apps/web: única capa que conoce las implementaciones
// concretas de infrastructure y las conecta a los casos de uso de packages/core.
export const commerce = {
  customers: new PrismaCustomerRepository(),
  offers: new PrismaOfferRepository(),
  checkoutSessions: new PrismaCheckoutSessionRepository(),
  orders: new PrismaOrderRepository(),
  payments: new PrismaPaymentRepository(),
  entitlements: new PrismaEntitlementRepository(),
  webhookEvents: new PrismaWebhookEventRepository(),
  pages: new PrismaPageRepository(),
  providers,
};
