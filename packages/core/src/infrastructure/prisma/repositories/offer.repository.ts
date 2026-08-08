import type { ThemeId as PrismaThemeId } from "@prisma/client";
import type { CreateOfferInput, CreatePriceInput, OfferRepository, UpdateOfferInput } from "../../../application";
import {
  assertEnabledProvidersAreCompatible,
  DEFAULT_THEME_ID,
  isValidThemeId,
  type PaymentProviderType,
  type Price,
  type ThemeId,
} from "../../../domain";
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

// Prisma no admite guiones en nombres de valor de enum — la columna real usa
// guion bajo (premium_light); el dominio y packages/ui usan guion medio
// (premium-light) porque así se ven en una URL/id de preset. Única frontera
// de traducción entre ambas representaciones.
const THEME_ID_TO_PRISMA: Record<ThemeId, PrismaThemeId> = {
  "premium-light": "premium_light",
  "premium-dark": "premium_dark",
  editorial: "editorial",
  "high-conversion": "high_conversion",
};
const THEME_ID_FROM_PRISMA: Record<PrismaThemeId, ThemeId> = {
  premium_light: "premium-light",
  premium_dark: "premium-dark",
  editorial: "editorial",
  high_conversion: "high-conversion",
};

function toDomainThemeId(stored: PrismaThemeId): ThemeId {
  return THEME_ID_FROM_PRISMA[stored];
}

function toStoredThemeId(domain: ThemeId | undefined): PrismaThemeId {
  // Solo `undefined` (campo omitido) aplica el default. `??` trataría un
  // `null` de un payload manipulado igual que "omitido" y lo convertiría en
  // premium-light en vez de rechazarlo — en un update() eso resetearía
  // silenciosamente el theme de una Offer existente en lugar de fallar.
  if (domain === undefined) {
    return THEME_ID_TO_PRISMA[DEFAULT_THEME_ID];
  }
  // Autoritativo: un themeId fuera del enum de dominio (payload manipulado,
  // el tipo TS no protege un valor ajeno en runtime) nunca debe poder persistirse.
  if (!isValidThemeId(domain)) {
    throw new Error(`themeId inválido: ${domain}`);
  }
  return THEME_ID_TO_PRISMA[domain];
}

function toDomainOffer<T extends { themeId: PrismaThemeId }>(offer: T): Omit<T, "themeId"> & { themeId: ThemeId } {
  const { themeId, ...rest } = offer;
  return { ...rest, themeId: toDomainThemeId(themeId) };
}

export class PrismaOfferRepository implements OfferRepository {
  async findById(offerId: string) {
    const offer = await prisma.offer.findUnique({ where: { id: offerId }, include: { prices: true } });
    if (!offer) return null;
    return toDomainOffer({ ...offer, prices: offer.prices.map(toDomainPrice) });
  }

  async list() {
    const offers = await prisma.offer.findMany({
      include: { prices: true, product: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return offers.map(({ product, prices, ...offer }) =>
      toDomainOffer({
        ...offer,
        prices: prices.map(toDomainPrice),
        productName: product.name,
      })
    );
  }

  async create(input: CreateOfferInput) {
    input.prices.forEach(validatePriceInput);
    const created = await prisma.offer.create({
      data: {
        productId: input.productId,
        name: input.name,
        validFrom: input.validFrom ?? null,
        validTo: input.validTo ?? null,
        themeId: toStoredThemeId(input.themeId),
        prices: {
          create: input.prices.map((price) => ({
            ...price,
            enabledProviders: toStoredEnabledProviders(price.enabledProviders),
          })),
        },
      },
    });
    return toDomainOffer(created);
  }

  async update(offerId: string, input: UpdateOfferInput) {
    const { themeId, ...rest } = input;
    const updated = await prisma.offer.update({
      where: { id: offerId },
      data: { ...rest, ...(themeId !== undefined ? { themeId: toStoredThemeId(themeId) } : {}) },
    });
    return toDomainOffer(updated);
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
