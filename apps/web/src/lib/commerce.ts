import {
  NodeApiKeyHasher,
  PrismaAssetRepository,
  PrismaCustomerRepository,
  PrismaOfferRepository,
  PrismaCheckoutSessionRepository,
  PrismaOrderRepository,
  PrismaPaymentRepository,
  PrismaEntitlementRepository,
  PrismaWebhookEventRepository,
  PrismaPageRepository,
  PrismaPreviewTokenRepository,
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
    apiBaseUrl: process.env.PAYPAL_API_BASE_URL ?? "https://api-m.sandbox.paypal.com",
    // `||`, no `??` — una APP_BASE_URL vacía ("") debe caer al default igual
    // que si no existiera (ver mismo fix en agent-api/.../preview/route.ts).
    webBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
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
  // F5 — verificar el PreviewToken de /preview/[token]. Mismo hasher que
  // ApiKey/PreviewToken en apps/agent-api (SHA-256 + timingSafeEqual).
  previewTokens: new PrismaPreviewTokenRepository(),
  previewTokenHasher: new NodeApiKeyHasher(),
  providers,
  // Fase 5 del editor de landings v2 (§7) — biblioteca de medios.
  assets: new PrismaAssetRepository(),
};
