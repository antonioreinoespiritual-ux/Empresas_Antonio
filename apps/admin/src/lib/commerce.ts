import {
  PrismaProductRepository,
  PrismaOfferRepository,
  PrismaPageRepository,
  PrismaOrderRepository,
  PrismaCustomerRepository,
} from "@repo/core/infrastructure";

// Composition root de apps/admin: solo lo que el panel necesita para
// administrar catálogo, contenido y ver pedidos/clientes (no procesa pagos
// ni webhooks — eso vive exclusivamente en apps/web).
export const commerce = {
  products: new PrismaProductRepository(),
  offers: new PrismaOfferRepository(),
  pages: new PrismaPageRepository(),
  orders: new PrismaOrderRepository(),
  customers: new PrismaCustomerRepository(),
};
