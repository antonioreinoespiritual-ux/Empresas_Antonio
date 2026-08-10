import { describe, expect, it } from "vitest";
import {
  apiKeyUnusableReason,
  authorizeAgentAction,
  hasScope,
  isClientUsable,
  isKeyUsable,
  isOfferAllowed,
  parseBearerToken,
} from "../src/domain";
import type { ApiClient, ApiKey } from "../src/domain";

function makeClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    id: "client_1",
    name: "Test Client",
    description: null,
    status: "ACTIVE",
    forceReadOnly: false,
    allowedOfferIds: null,
    createdByAdminId: "admin_1",
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: "key_1",
    apiClientId: "client_1",
    keyPrefix: "ak_prefix",
    secretHash: "hash",
    scopes: [],
    expiresAt: null,
    revokedAt: null,
    rateLimitOverride: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

describe("parseBearerToken", () => {
  it("separa keyPrefix y secret en el primer punto", () => {
    expect(parseBearerToken("Bearer ak_abc.secretvalue")).toEqual({ keyPrefix: "ak_abc", secret: "secretvalue" });
  });

  it("acepta un secret que contiene puntos (solo el primero separa)", () => {
    expect(parseBearerToken("Bearer ak_abc.sec.ret")).toEqual({ keyPrefix: "ak_abc", secret: "sec.ret" });
  });

  const invalidHeaders: (string | null | undefined)[] = [
    undefined,
    null,
    "",
    "Basic ak_abc.secret",
    "Bearer ak_abcsecret",
    "Bearer .secret",
    "Bearer ak_abc.",
  ];

  it.each(invalidHeaders)("rechaza header inválido: %s", (header) => {
    expect(parseBearerToken(header)).toBeNull();
  });
});

describe("isClientUsable / kill switch por cliente", () => {
  it("ACTIVE es usable", () => {
    expect(isClientUsable(makeClient({ status: "ACTIVE" }))).toBe(true);
  });

  it("SUSPENDED no es usable", () => {
    expect(isClientUsable(makeClient({ status: "SUSPENDED" }))).toBe(false);
  });
});

describe("isOfferAllowed", () => {
  it("null = todas las Offers permitidas", () => {
    expect(isOfferAllowed(makeClient({ allowedOfferIds: null }), "offer_cualquiera")).toBe(true);
  });

  it("[] = ninguna Offer permitida", () => {
    expect(isOfferAllowed(makeClient({ allowedOfferIds: [] }), "offer_1")).toBe(false);
  });

  it("array = solo las Offers listadas", () => {
    const client = makeClient({ allowedOfferIds: ["offer_1", "offer_2"] });
    expect(isOfferAllowed(client, "offer_1")).toBe(true);
    expect(isOfferAllowed(client, "offer_3")).toBe(false);
  });
});

describe("apiKeyUnusableReason / isKeyUsable / kill switch por key", () => {
  const now = new Date("2026-08-10T00:00:00Z");

  it("key sin revokedAt ni expiresAt es usable", () => {
    expect(isKeyUsable(makeKey(), now)).toBe(true);
    expect(apiKeyUnusableReason(makeKey(), now)).toBeNull();
  });

  it("revokedAt !== null -> 'revoked', gana sobre expiresAt futuro", () => {
    const key = makeKey({ revokedAt: new Date("2026-08-05T00:00:00Z"), expiresAt: new Date("2027-01-01T00:00:00Z") });
    expect(apiKeyUnusableReason(key, now)).toBe("revoked");
    expect(isKeyUsable(key, now)).toBe(false);
  });

  it("expiresAt en el pasado -> 'expired'", () => {
    const key = makeKey({ expiresAt: new Date("2026-08-09T00:00:00Z") });
    expect(apiKeyUnusableReason(key, now)).toBe("expired");
  });

  it("expiresAt exactamente 'now' ya cuenta como expirada (>=)", () => {
    const key = makeKey({ expiresAt: now });
    expect(apiKeyUnusableReason(key, now)).toBe("expired");
  });

  it("expiresAt en el futuro es usable", () => {
    const key = makeKey({ expiresAt: new Date("2026-08-11T00:00:00Z") });
    expect(isKeyUsable(key, now)).toBe(true);
  });
});

describe("hasScope", () => {
  it("true si el scope está en la lista", () => {
    expect(hasScope(makeKey({ scopes: ["pages:read", "pages:write"] }), "pages:read")).toBe(true);
  });

  it("false si no está, incluida una key sin scopes", () => {
    expect(hasScope(makeKey({ scopes: [] }), "pages:read")).toBe(false);
  });
});

describe("authorizeAgentAction", () => {
  const principal = {
    apiClientId: "client_1",
    apiKeyId: "key_1",
    clientName: "Test Client",
    scopes: ["pages:read"],
    allowedOfferIds: ["offer_1"],
    forceReadOnly: false,
  };

  it("permite una lectura sin scope declarado (introspección de identidad)", () => {
    expect(authorizeAgentAction(principal, { isWrite: false })).toEqual({ ok: true });
  });

  it("permite una acción cuyo scope sí tiene la key", () => {
    expect(authorizeAgentAction(principal, { scope: "pages:read", isWrite: false })).toEqual({ ok: true });
  });

  it("deniega por missing_scope si la key no tiene el scope requerido", () => {
    expect(authorizeAgentAction(principal, { scope: "pages:write", isWrite: false })).toEqual({
      ok: false,
      reason: "missing_scope",
    });
  });

  it("deniega por read_only si forceReadOnly=true y la acción escribe, incluso con el scope correcto", () => {
    const readOnlyPrincipal = { ...principal, forceReadOnly: true, scopes: ["pages:write"] };
    expect(authorizeAgentAction(readOnlyPrincipal, { scope: "pages:write", isWrite: true })).toEqual({
      ok: false,
      reason: "read_only",
    });
  });

  it("read_only no afecta acciones de lectura", () => {
    const readOnlyPrincipal = { ...principal, forceReadOnly: true };
    expect(authorizeAgentAction(readOnlyPrincipal, { scope: "pages:read", isWrite: false })).toEqual({ ok: true });
  });

  it("permite una Offer dentro del allow-list", () => {
    expect(authorizeAgentAction(principal, { offerId: "offer_1", isWrite: false })).toEqual({ ok: true });
  });

  it("deniega por offer_not_allowed fuera del allow-list", () => {
    expect(authorizeAgentAction(principal, { offerId: "offer_2", isWrite: false })).toEqual({
      ok: false,
      reason: "offer_not_allowed",
    });
  });

  it("allowedOfferIds=null permite cualquier offerId", () => {
    const unrestricted = { ...principal, allowedOfferIds: null };
    expect(authorizeAgentAction(unrestricted, { offerId: "offer_cualquiera", isWrite: false })).toEqual({ ok: true });
  });

  it("read_only se evalúa antes que missing_scope (orden de chequeo estable)", () => {
    const readOnlyPrincipal = { ...principal, forceReadOnly: true, scopes: [] };
    expect(authorizeAgentAction(readOnlyPrincipal, { scope: "pages:write", isWrite: true })).toEqual({
      ok: false,
      reason: "read_only",
    });
  });
});
