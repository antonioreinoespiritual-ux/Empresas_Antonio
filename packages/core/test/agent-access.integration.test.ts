import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { authenticateAgentRequest, issueApiKey } from "../src/application";
import { NodeApiKeyHasher, NodeApiKeySecretGenerator, PrismaApiClientRepository, PrismaApiKeyRepository } from "../src/infrastructure";
import { prisma } from "../src/infrastructure/prisma/client";

// Requiere Postgres real vía DATABASE_URL (ver test/setup.ts) — igual que
// wompi-webhook.integration.test.ts y paypal-webhook.integration.test.ts.
// No ejecutable en un sandbox sin base de datos (ver docs/roadmap/
// agent-access-layer.md, cierre de F1).

const apiClients = new PrismaApiClientRepository();
const apiKeys = new PrismaApiKeyRepository();
const hasher = new NodeApiKeyHasher();
const secretGenerator = new NodeApiKeySecretGenerator();
const actor = { actorType: "test", actorId: "vitest" };

async function createTestAdmin() {
  return prisma.adminUser.create({ data: { email: `admin-${randomUUID()}@test.local`, name: "Test Admin" } });
}

async function countAuditLogs(entity: string, entityId: string) {
  return prisma.auditLog.count({ where: { entity, entityId } });
}

describe("PrismaApiClientRepository: ciclo de vida + auditoría atómica", () => {
  it("create() sin allowedOfferIds persiste NULL real en Postgres (todas las Offers), no [] (Prisma colapsaría ambos)", async () => {
    const admin = await createTestAdmin();
    const client = await apiClients.create({ name: "Cliente sin restricción", createdByAdminId: admin.id }, actor);

    expect(client.allowedOfferIds).toBeNull();

    const reloaded = await apiClients.findById(client.id);
    expect(reloaded?.allowedOfferIds).toBeNull();

    const rawRows = await prisma.$queryRawUnsafe<{ allowedOfferIds: string[] | null }[]>(
      `SELECT "allowedOfferIds" FROM "api_clients" WHERE "id" = $1`,
      client.id
    );
    expect(rawRows[0]?.allowedOfferIds).toBeNull();
  });

  it("create() con allowedOfferIds: [] persiste [] real (ninguna Offer), distinguible de NULL", async () => {
    const admin = await createTestAdmin();
    const client = await apiClients.create(
      { name: "Cliente sin ninguna Offer", createdByAdminId: admin.id, allowedOfferIds: [] },
      actor
    );

    expect(client.allowedOfferIds).toEqual([]);
    const reloaded = await apiClients.findById(client.id);
    expect(reloaded?.allowedOfferIds).toEqual([]);
  });

  it("create() con allow-list explícita la persiste tal cual", async () => {
    const admin = await createTestAdmin();
    const client = await apiClients.create(
      { name: "Cliente con allow-list", createdByAdminId: admin.id, allowedOfferIds: ["offer_a", "offer_b"] },
      actor
    );

    expect(client.allowedOfferIds).toEqual(["offer_a", "offer_b"]);
  });

  it("create() escribe un AuditLog atómico junto con el ApiClient", async () => {
    const admin = await createTestAdmin();
    const client = await apiClients.create({ name: "Cliente auditado", createdByAdminId: admin.id }, actor);

    const count = await countAuditLogs("ApiClient", client.id);
    expect(count).toBe(1);

    const entry = await prisma.auditLog.findFirst({ where: { entity: "ApiClient", entityId: client.id } });
    expect(entry?.action).toBe("api_client.created");
    expect(entry?.actorType).toBe("test");
  });

  it("setStatus() es el kill switch por cliente y queda auditado", async () => {
    const admin = await createTestAdmin();
    const client = await apiClients.create({ name: "Cliente a suspender", createdByAdminId: admin.id }, actor);

    const suspended = await apiClients.setStatus(client.id, "SUSPENDED", actor);
    expect(suspended.status).toBe("SUSPENDED");

    const auditEntries = await prisma.auditLog.findMany({ where: { entity: "ApiClient", entityId: client.id } });
    expect(auditEntries.map((e) => e.action)).toEqual(["api_client.created", "api_client.status_changed"]);
  });

  it("setForceReadOnly() queda auditado y no toca allowedOfferIds", async () => {
    const admin = await createTestAdmin();
    const client = await apiClients.create(
      { name: "Cliente read-only", createdByAdminId: admin.id, allowedOfferIds: ["offer_a"] },
      actor
    );

    const updated = await apiClients.setForceReadOnly(client.id, true, actor);
    expect(updated.forceReadOnly).toBe(true);
    expect(updated.allowedOfferIds).toEqual(["offer_a"]);
  });

  it("setAllowedOfferIds() puede volver a NULL (todas las Offers) desde una allow-list previa", async () => {
    const admin = await createTestAdmin();
    const client = await apiClients.create(
      { name: "Cliente a des-restringir", createdByAdminId: admin.id, allowedOfferIds: ["offer_a"] },
      actor
    );

    const widened = await apiClients.setAllowedOfferIds(client.id, null, actor);
    expect(widened.allowedOfferIds).toBeNull();
  });
});

describe("PrismaApiKeyRepository: emisión, hash y revocación idempotente", () => {
  it("issueApiKey (use-case) nunca persiste el secreto en claro, solo su hash", async () => {
    const admin = await createTestAdmin();
    const client = await apiClients.create({ name: "Cliente con key", createdByAdminId: admin.id }, actor);

    const { apiKey, plaintextKey } = await issueApiKey(
      { apiClients, apiKeys, hasher, secretGenerator },
      { apiClientId: client.id, scopes: ["pages:read"] },
      actor
    );

    expect(plaintextKey).toContain(apiKey.keyPrefix);
    expect(apiKey.secretHash).not.toBe(plaintextKey);
    const secret = plaintextKey.slice(apiKey.keyPrefix.length + 1);
    expect(hasher.verify(secret, apiKey.secretHash)).toBe(true);

    const found = await apiKeys.findByPrefix(apiKey.keyPrefix);
    expect(found?.id).toBe(apiKey.id);
  });

  it("revoke() es no-op auditado la segunda vez (no pisa revokedAt ni duplica el AuditLog)", async () => {
    const admin = await createTestAdmin();
    const client = await apiClients.create({ name: "Cliente a revocar", createdByAdminId: admin.id }, actor);
    const { apiKey } = await issueApiKey({ apiClients, apiKeys, hasher, secretGenerator }, { apiClientId: client.id, scopes: [] }, actor);

    const firstRevoke = await apiKeys.revoke(apiKey.id, actor);
    expect(firstRevoke.revokedAt).not.toBeNull();

    const secondRevoke = await apiKeys.revoke(apiKey.id, actor);
    expect(secondRevoke.revokedAt?.getTime()).toBe(firstRevoke.revokedAt?.getTime());

    const auditCount = await countAuditLogs("ApiKey", apiKey.id);
    // 1 por issue + 1 por la primera revocación; la segunda no agrega nada.
    expect(auditCount).toBe(2);
  });
});

describe("authenticateAgentRequest: los 3 kill switches + credenciales", () => {
  const deps = () => ({ apiClients, apiKeys, hasher });

  async function issueTestKey(overrides: { forceReadOnly?: boolean; status?: "ACTIVE" | "SUSPENDED" } = {}) {
    const admin = await createTestAdmin();
    let client = await apiClients.create(
      { name: `Cliente auth ${randomUUID()}`, createdByAdminId: admin.id, forceReadOnly: overrides.forceReadOnly },
      actor
    );
    if (overrides.status) {
      client = await apiClients.setStatus(client.id, overrides.status, actor);
    }
    const { apiKey, plaintextKey } = await issueApiKey(
      { apiClients, apiKeys, hasher, secretGenerator },
      { apiClientId: client.id, scopes: ["pages:read"] },
      actor
    );
    return { client, apiKey, plaintextKey };
  }

  it("autentica una key válida y resuelve el AgentPrincipal completo", async () => {
    const { client, apiKey, plaintextKey } = await issueTestKey();

    const result = await authenticateAgentRequest(deps(), {
      authorizationHeader: `Bearer ${plaintextKey}`,
      now: new Date(),
      killSwitchEngaged: false,
    });

    expect(result).toEqual({
      ok: true,
      principal: {
        apiClientId: client.id,
        apiKeyId: apiKey.id,
        clientName: client.name,
        scopes: ["pages:read"],
        allowedOfferIds: null,
        forceReadOnly: false,
      },
    });
  });

  it("kill_switch_engaged deniega sin tocar la base (ni siquiera con credenciales válidas)", async () => {
    const { plaintextKey } = await issueTestKey();

    const result = await authenticateAgentRequest(deps(), {
      authorizationHeader: `Bearer ${plaintextKey}`,
      now: new Date(),
      killSwitchEngaged: true,
    });

    expect(result).toEqual({ ok: false, reason: "kill_switch_engaged" });
  });

  it("invalid_credentials para header ausente, prefix desconocido y secreto incorrecto (mismo motivo en los 3 casos)", async () => {
    const { apiKey } = await issueTestKey();

    const noHeader = await authenticateAgentRequest(deps(), { authorizationHeader: null, now: new Date(), killSwitchEngaged: false });
    expect(noHeader).toEqual({ ok: false, reason: "invalid_credentials" });

    const unknownPrefix = await authenticateAgentRequest(deps(), {
      authorizationHeader: "Bearer ak_no-existe.secreto",
      now: new Date(),
      killSwitchEngaged: false,
    });
    expect(unknownPrefix).toEqual({ ok: false, reason: "invalid_credentials" });

    const wrongSecret = await authenticateAgentRequest(deps(), {
      authorizationHeader: `Bearer ${apiKey.keyPrefix}.secreto-incorrecto`,
      now: new Date(),
      killSwitchEngaged: false,
    });
    expect(wrongSecret).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("key_revoked deniega e incluye apiClientId/apiKeyId para la auditoría", async () => {
    const { apiKey, plaintextKey } = await issueTestKey();
    await apiKeys.revoke(apiKey.id, actor);

    const result = await authenticateAgentRequest(deps(), {
      authorizationHeader: `Bearer ${plaintextKey}`,
      now: new Date(),
      killSwitchEngaged: false,
    });

    expect(result).toEqual({ ok: false, reason: "key_revoked", apiClientId: apiKey.apiClientId, apiKeyId: apiKey.id });
  });

  it("key_expired deniega cuando expiresAt ya pasó", async () => {
    const admin = await createTestAdmin();
    const client = await apiClients.create({ name: `Cliente expirado ${randomUUID()}`, createdByAdminId: admin.id }, actor);
    const { apiKey, plaintextKey } = await issueApiKey(
      { apiClients, apiKeys, hasher, secretGenerator },
      { apiClientId: client.id, scopes: [], expiresAt: new Date("2020-01-01T00:00:00Z") },
      actor
    );

    const result = await authenticateAgentRequest(deps(), {
      authorizationHeader: `Bearer ${plaintextKey}`,
      now: new Date(),
      killSwitchEngaged: false,
    });

    expect(result).toEqual({ ok: false, reason: "key_expired", apiClientId: client.id, apiKeyId: apiKey.id });
  });

  it("client_suspended deniega toda key de un cliente suspendido (kill switch por cliente)", async () => {
    const { client, apiKey, plaintextKey } = await issueTestKey({ status: "SUSPENDED" });

    const result = await authenticateAgentRequest(deps(), {
      authorizationHeader: `Bearer ${plaintextKey}`,
      now: new Date(),
      killSwitchEngaged: false,
    });

    expect(result).toEqual({ ok: false, reason: "client_suspended", apiClientId: client.id, apiKeyId: apiKey.id });
  });
});
