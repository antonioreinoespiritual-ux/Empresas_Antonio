import type { CreateOfferInput, CreatePriceInput, OfferRepository, UpdateOfferInput } from "../../../application";
import { assertEnabledProvidersAreCompatible, type PaymentProviderType, type Price } from "../../../domain";
import { prisma } from "../client";

// Prisma no admite listas escalares opcionales (String[]? no existe) — la
// columna real siempre es un array, [] en la base representa "sin
// restricción". El dominio usa null para ese mismo significado; esta es la
// única frontera donde se traduce entre ambas representaciones.
function toDomainEnabledProviders(stored: PaymentProviderType[]): PaymentProviderType[] | null {
  return stored.length === 0 ? null : stored;
}

function toStoredEnabledProviders(domain: PaymentProviderType[] | null | undefined): PaymentProviderType[] {
  return domain ?? [];
}

function toDomainPrice<T extends { enabledProviders: PaymentProviderType[] }>(
  price: T
): Omit<T, "enabledProviders"> & Pick<Price, "enabledProviders"> {
  const { enabledProviders, ...rest } = price;
  return { ...rest, enabledProviders: toDomainEnabledProviders(enabledProviders) };
}

function validatePriceInput(price: CreatePriceInput): void {
  // Autoritativo: aunque la UI de admin ya evita marcar un proveedor
  // incompatible, esto es lo que impide que un payload manipulado lo fuerce.
  assertEnabledProvidersAreCompatible(price.currency, price.enabledProviders ?? null);
}

export class PrismaOfferRepository implements OfferRepository {
  async findById(offerId: string) {
    const offer = await prisma.offer.findUnique({ where: { id: offerId }, include: { prices: true } });
    if (!offer) return null;
    return { ...offer, prices: offer.prices.map(toDomainPrice) };
  }

  async list() {
    const offers = await prisma.offer.findMany({
      include: { prices: true, product: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return offers.map(({ product, prices, ...offer }) => ({
      ...offer,
      prices: prices.map(toDomainPrice),
      productName: product.name,
    }));
  }

  async create(input: CreateOfferInput) {
    input.prices.forEach(validatePriceInput);
    return prisma.offer.create({
      data: {
        productId: input.productId,
        name: input.name,
        validFrom: input.validFrom ?? null,
        validTo: input.validTo ?? null,
        prices: {
          create: input.prices.map((price) => ({
            ...price,
            enabledProviders: toStoredEnabledProviders(price.enabledProviders),
          })),
        },
      },
    });
  }

  async update(offerId: string, input: UpdateOfferInput) {
    return prisma.offer.update({ where: { id: offerId }, data: input });
  }

  async setActive(offerId: string, isActive: boolean): Promise<void> {
    await prisma.offer.update({ where: { id: offerId }, data: { isActive } });
  }

  async addPrice(offerId: string, price: CreatePriceInput) {
    validatePriceInput(price);
    const created = await prisma.price.create({
      data: { offerId, ...price, enabledProviders: toStoredEnabledProviders(price.enabledProviders) },
    });
    return toDomainPrice(created);
  }

  async removePrice(priceId: string): Promise<void> {
    await prisma.price.delete({ where: { id: priceId } });
  }
}
