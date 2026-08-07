import {
  PrismaProductRepository,
  PrismaOfferRepository,
  PrismaPageRepository,
} from "@repo/core/infrastructure";

// Composition root de apps/admin: solo lo que el panel necesita para
// administrar catálogo y contenido (no procesa pagos ni webhooks).
export const commerce = {
  products: new PrismaProductRepository(),
  offers: new PrismaOfferRepository(),
  pages: new PrismaPageRepository(),
};
