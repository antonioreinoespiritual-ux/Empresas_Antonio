import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { NodeApiKeyHasher, PrismaAgentAuditLogRepository, PrismaApiClientRepository, PrismaApiKeyRepository } from "../src/infrastructure";
import { prisma } from "../src/infrastructure/prisma/client";

// F6 — el visor de auditoría en apps/admin pagina sobre esta tabla vía
// cursor (mismo patrón que listForAgent() en F3/retrofit). Sin esta prueba,
// un error de off-by-one en el cursor (duplicar o saltar una fila entre
// páginas) solo se detectaría manualmente en el navegador.

const auditLogs = new PrismaAgentAuditLogRepository();
const apiClients = new PrismaApiClientRepository();
const apiKeys = new PrismaApiKeyRepository();
const hasher = new NodeApiKeyHasher();
const actor = { actorType: "test", actorId: "vitest-audit-log-list" };

async function createTestAgentIdentity() {
  const admin = await prisma.adminUser.create({ data: { email: `admin-${randomUUID()}@test.local`, name: "Test Admin" } });
  const client = await apiClients.create({ name: `Cliente audit-log ${randomUUID()}`, createdByAdminId: admin.id }, actor);
  const issued = await apiKeys.issue(
    { apiClientId: client.id, keyPrefix: `ak_${randomUUID()}`, secretHash: hasher.hash("irrelevante"), scopes: ["read"] },
    actor
  );
  return { apiClientId: client.id, apiKeyId: issued.id };
}

async function recordEntries(apiClientId: string, apiKeyId: string, count: number) {
  for (let i = 0; i < count; i++) {
    await auditLogs.record({
      requestId: randomUUID(),
      apiClientId,
      apiKeyId,
      method: "GET",
      resourceType: "Page",
      resourceId: `page-${i}`,
      statusCode: 200,
      latencyMs: 1,
      outcome: "ok",
    });
  }
}

describe("PrismaAgentAuditLogRepository.list: filtro por cliente y paginación por cursor", () => {
  it("sin filtro, devuelve solo las entradas de un cliente cuando se filtra por apiClientId", async () => {
    const a = await createTestAgentIdentity();
    const b = await createTestAgentIdentity();
    await recordEntries(a.apiClientId, a.apiKeyId, 3);
    await recordEntries(b.apiClientId, b.apiKeyId, 2);

    const { items, nextCursor } = await auditLogs.list({ apiClientId: a.apiClientId, limit: 50 });

    expect(items).toHaveLength(3);
    expect(items.every((item) => item.apiClientId === a.apiClientId)).toBe(true);
    expect(nextCursor).toBeNull();
  });

  it("sin apiClientId, incluye entradas de todos los clientes", async () => {
    const a = await createTestAgentIdentity();
    const b = await createTestAgentIdentity();
    await recordEntries(a.apiClientId, a.apiKeyId, 1);
    await recordEntries(b.apiClientId, b.apiKeyId, 1);

    const { items } = await auditLogs.list({ limit: 500 });
    const ids = new Set(items.map((item) => item.apiClientId));

    expect(ids.has(a.apiClientId)).toBe(true);
    expect(ids.has(b.apiClientId)).toBe(true);
  });

  it("pagina por cursor sin duplicar ni saltar filas, en orden createdAt desc", async () => {
    const identity = await createTestAgentIdentity();
    await recordEntries(identity.apiClientId, identity.apiKeyId, 7);

    const collected: string[] = [];
    let cursor: string | undefined;
    for (let guard = 0; guard < 10; guard++) {
      const page = await auditLogs.list({ apiClientId: identity.apiClientId, cursor, limit: 3 });
      collected.push(...page.items.map((item) => item.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }

    expect(collected).toHaveLength(7);
    expect(new Set(collected).size).toBe(7);

    const all = await auditLogs.list({ apiClientId: identity.apiClientId, limit: 50 });
    expect(collected).toEqual(all.items.map((item) => item.id));
  });

  it("nextCursor es null cuando la última página coincide exactamente con el limit", async () => {
    const identity = await createTestAgentIdentity();
    await recordEntries(identity.apiClientId, identity.apiKeyId, 4);

    const page = await auditLogs.list({ apiClientId: identity.apiClientId, limit: 4 });

    expect(page.items).toHaveLength(4);
    expect(page.nextCursor).toBeNull();
  });
});
