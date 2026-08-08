import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_ID, isValidThemeId, THEME_IDS } from "../src/domain";
import { PrismaOfferRepository } from "../src/infrastructure";
import { prisma } from "../src/infrastructure/prisma/client";

describe("ThemeId: 4 ids cerrados, ninguno arbitrario", () => {
  it("acepta exactamente los 4 presets aprobados", () => {
    expect(THEME_IDS).toEqual(["premium-light", "premium-dark", "editorial", "high-conversion"]);
  });

  it("isValidThemeId rechaza cualquier valor fuera del enum", () => {
    expect(isValidThemeId("premium-light")).toBe(true);
    expect(isValidThemeId("custom-css-injection")).toBe(false);
    expect(isValidThemeId("")).toBe(false);
  });
});

describe("PrismaOfferRepository: themeId real contra Postgres", () => {
  async function createProduct() {
    return prisma.product.create({
      data: { name: `Test Product ${randomUUID()}`, type: "DIGITAL", status: "PUBLISHED" },
    });
  }

  it("create() sin themeId persiste el default (premium-light)", async () => {
    const product = await createProduct();
    const repo = new PrismaOfferRepository();

    const offer = await repo.create({
      productId: product.id,
      name: "Oferta sin theme explícito",
      prices: [{ amount: 1000, currency: "USD", interval: "ONE_TIME" }],
    });

    expect(offer.themeId).toBe(DEFAULT_THEME_ID);
  });

  it("create() con themeId explícito lo persiste y lo devuelve tal cual (round-trip)", async () => {
    const product = await createProduct();
    const repo = new PrismaOfferRepository();

    const created = await repo.create({
      productId: product.id,
      name: "Oferta editorial",
      themeId: "editorial",
      prices: [{ amount: 1000, currency: "USD", interval: "ONE_TIME" }],
    });
    expect(created.themeId).toBe("editorial");

    const found = await repo.findById(created.id);
    expect(found?.themeId).toBe("editorial");
  });

  it("update() cambia el themeId de una Offer existente", async () => {
    const product = await createProduct();
    const repo = new PrismaOfferRepository();
    const created = await repo.create({
      productId: product.id,
      name: "Oferta a rebrandear",
      prices: [{ amount: 1000, currency: "USD", interval: "ONE_TIME" }],
    });
    expect(created.themeId).toBe(DEFAULT_THEME_ID);

    const updated = await repo.update(created.id, { themeId: "high-conversion" });
    expect(updated.themeId).toBe("high-conversion");
  });

  it("list() incluye el themeId de cada Offer", async () => {
    const product = await createProduct();
    const repo = new PrismaOfferRepository();
    await repo.create({
      productId: product.id,
      name: "Oferta dark para el listado",
      themeId: "premium-dark",
      prices: [{ amount: 1000, currency: "USD", interval: "ONE_TIME" }],
    });

    const offers = await repo.list();
    const found = offers.find((o) => o.name === "Oferta dark para el listado");
    expect(found?.themeId).toBe("premium-dark");
  });
});
