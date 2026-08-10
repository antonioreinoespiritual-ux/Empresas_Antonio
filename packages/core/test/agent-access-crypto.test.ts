import { describe, expect, it } from "vitest";
import { NodeApiKeyHasher, NodeApiKeySecretGenerator } from "../src/infrastructure/agent-access/api-key-crypto";

describe("NodeApiKeyHasher", () => {
  const hasher = new NodeApiKeyHasher();

  it("verify() acepta el secreto correcto contra su propio hash", () => {
    const hash = hasher.hash("un-secreto-de-alta-entropia");
    expect(hasher.verify("un-secreto-de-alta-entropia", hash)).toBe(true);
  });

  it("verify() rechaza un secreto incorrecto", () => {
    const hash = hasher.hash("secreto-correcto");
    expect(hasher.verify("secreto-incorrecto", hash)).toBe(false);
  });

  it("verify() rechaza un hash de otra longitud sin lanzar (timingSafeEqual necesita igual longitud)", () => {
    expect(hasher.verify("cualquier-secreto", "deadbeef")).toBe(false);
  });

  it("hash() es determinístico para el mismo secreto", () => {
    expect(hasher.hash("mismo-secreto")).toBe(hasher.hash("mismo-secreto"));
  });

  it("hash() nunca devuelve el secreto en claro", () => {
    expect(hasher.hash("mi-secreto-super-largo")).not.toContain("mi-secreto-super-largo");
  });
});

describe("NodeApiKeySecretGenerator", () => {
  const generator = new NodeApiKeySecretGenerator();

  it("genera keyPrefix y secret no vacíos, sin punto (delimitador del bearer token)", () => {
    const material = generator.generate();
    expect(material.keyPrefix.length).toBeGreaterThan(0);
    expect(material.secret.length).toBeGreaterThan(0);
    expect(material.keyPrefix).not.toContain(".");
    expect(material.secret).not.toContain(".");
  });

  it("genera material distinto en cada llamada", () => {
    const a = generator.generate();
    const b = generator.generate();
    expect(a.keyPrefix).not.toBe(b.keyPrefix);
    expect(a.secret).not.toBe(b.secret);
  });
});
