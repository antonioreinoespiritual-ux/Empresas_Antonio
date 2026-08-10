import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma as adminPrisma } from "../src/infrastructure/prisma/client";

// F8 (PLAN-AGENT-API-01, ítems 45-58): "default-deny por tabla nueva" y
// "matriz negativa por operación" — no una prueba inventada sobre lo que
// *creemos* que agent_api_role puede hacer, sino la ejecución REAL del
// script de producción (prisma/agent-access-layer/create_agent_api_role.sql)
// contra Postgres real, conectando después como ese rol exacto y probando
// cada verbo. Si el script y este test se desincronizan, uno de los dos
// falla — nunca queda una suposición sin verificar.
//
// Requiere DATABASE_URL/DIRECT_URL de un superusuario local (mismo
// requisito que el resto de test/*.integration.test.ts) para poder crear
// el rol restringido — nunca corre contra la base real de Supabase.

const TEST_ROLE_PASSWORD = `test-${randomUUID()}`;
const ROLE_NAME = "agent_api_role";
const UNGRANTED_TABLE = "test_never_granted_table";

function agentRoleDatabaseUrl(): string {
  const adminUrl = new URL(process.env.DATABASE_URL!);
  const roleUrl = new URL(adminUrl.toString());
  roleUrl.username = ROLE_NAME;
  roleUrl.password = TEST_ROLE_PASSWORD;
  return roleUrl.toString();
}

let agentPrisma: PrismaClient;
let seeded: { adminId: string; clientId: string; keyId: string; productId: string; offerId: string; priceId: string; pageId: string };

const PERMISSION_DENIED = "42501";

async function expectDenied(fn: () => Promise<unknown>) {
  try {
    await fn();
    throw new Error("Se esperaba permission denied (42501) pero la operación tuvo éxito");
  } catch (error) {
    const code = (error as { code?: string; meta?: { code?: string } })?.meta?.code ?? (error as { code?: string }).code;
    expect(code).toBe(PERMISSION_DENIED);
  }
}

beforeAll(async () => {
  // 1) Rol restringido: se ejecuta el script REAL de producción, no una
  // copia a mano — solo se sustituye el placeholder de password.
  const scriptPath = path.resolve(__dirname, "../../../prisma/agent-access-layer/create_agent_api_role.sql");
  const dbName = new URL(process.env.DATABASE_URL!).pathname.replace(/^\//, "");
  const rawScript = readFileSync(scriptPath, "utf8")
    .replace("PASSWORD '<PASSWORD_SEGURA>'", `PASSWORD '${TEST_ROLE_PASSWORD}'`)
    // El script real apunta a la base "postgres" de producción por nombre —
    // localmente cada corrida usa una base descartable con otro nombre.
    .replace("ON DATABASE postgres", `ON DATABASE "${dbName}"`);
  // Los comentarios "--" del script incluyen prosa con puntuación real (hay
  // un ";" dentro de una oración de comentario) — no se puede partir el
  // script en statements por ";" antes de quitar los comentarios línea por
  // línea, o ese ";" de la prosa corta un statement real por la mitad.
  const script = rawScript
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
  const statements = script
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    await adminPrisma.$executeRawUnsafe(statement);
  }

  // 2) Tabla nueva sin ningún GRANT — el caso "default-deny por tabla nueva".
  await adminPrisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "${UNGRANTED_TABLE}" (id text PRIMARY KEY)`);

  // 3) Datos mínimos reales para que los SELECT "permitidos" confirmen
  // acceso a filas de verdad, no solo "una tabla vacía no truena".
  const admin = await adminPrisma.adminUser.create({ data: { email: `admin-${randomUUID()}@test.local`, name: "F8 Admin" } });
  const client = await adminPrisma.apiClient.create({ data: { name: "F8 Grants Client", createdByAdminId: admin.id } });
  const key = await adminPrisma.apiKey.create({
    data: { apiClientId: client.id, keyPrefix: `ak_${randomUUID()}`, secretHash: "irrelevante", scopes: ["read"] },
  });
  const product = await adminPrisma.product.create({ data: { name: "F8 Product", type: "DIGITAL" } });
  const offer = await adminPrisma.offer.create({ data: { productId: product.id, name: "F8 Offer" } });
  const price = await adminPrisma.price.create({ data: { offerId: offer.id, amount: 1000, currency: "USD", interval: "ONE_TIME" } });
  const page = await adminPrisma.page.create({ data: { offerId: offer.id, kind: "LANDING", content: { heroTitle: "x" } } });

  seeded = { adminId: admin.id, clientId: client.id, keyId: key.id, productId: product.id, offerId: offer.id, priceId: price.id, pageId: page.id };

  agentPrisma = new PrismaClient({ datasources: { db: { url: agentRoleDatabaseUrl() } } });
  await agentPrisma.$connect();
}, 30_000);

afterAll(async () => {
  await agentPrisma.$disconnect();
  await adminPrisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${UNGRANTED_TABLE}"`);
  await adminPrisma.apiKey.deleteMany({ where: { apiClientId: seeded.clientId } });
  await adminPrisma.apiClient.deleteMany({ where: { id: seeded.clientId } });
  await adminPrisma.page.deleteMany({ where: { id: seeded.pageId } });
  await adminPrisma.price.deleteMany({ where: { id: seeded.priceId } });
  await adminPrisma.offer.deleteMany({ where: { id: seeded.offerId } });
  await adminPrisma.product.deleteMany({ where: { id: seeded.productId } });
  await adminPrisma.adminUser.deleteMany({ where: { id: seeded.adminId } });
  await adminPrisma.$executeRawUnsafe(`DROP OWNED BY ${ROLE_NAME}`);
  await adminPrisma.$executeRawUnsafe(`DROP ROLE IF EXISTS ${ROLE_NAME}`);
}, 30_000);

describe("agent_api_role: default-deny por tabla nueva (F8)", () => {
  it("no puede leer una tabla creada sin ningún GRANT explícito", async () => {
    await expectDenied(() => agentPrisma.$queryRawUnsafe(`SELECT * FROM "${UNGRANTED_TABLE}"`));
  });

  it("no puede escribir en una tabla creada sin ningún GRANT explícito", async () => {
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`INSERT INTO "${UNGRANTED_TABLE}" (id) VALUES ('x')`));
  });
});

describe("agent_api_role: matriz negativa por operación, tabla por tabla (F8)", () => {
  it("api_clients: SELECT sí, INSERT/UPDATE/DELETE no", async () => {
    const rows = await agentPrisma.$queryRawUnsafe(`SELECT * FROM "api_clients" WHERE id = $1`, seeded.clientId);
    expect(Array.isArray(rows)).toBe(true);
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`UPDATE "api_clients" SET name = 'x' WHERE id = $1`, seeded.clientId));
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`DELETE FROM "api_clients" WHERE id = $1`, seeded.clientId));
    await expectDenied(() =>
      agentPrisma.$executeRawUnsafe(`INSERT INTO "api_clients" (id, name, "createdByAdminId") VALUES ('x', 'x', 'x')`)
    );
  });

  it("api_keys: SELECT sí, INSERT/UPDATE/DELETE no", async () => {
    const rows = await agentPrisma.$queryRawUnsafe(`SELECT * FROM "api_keys" WHERE id = $1`, seeded.keyId);
    expect(Array.isArray(rows)).toBe(true);
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`UPDATE "api_keys" SET "keyPrefix" = 'x' WHERE id = $1`, seeded.keyId));
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`DELETE FROM "api_keys" WHERE id = $1`, seeded.keyId));
    await expectDenied(() =>
      agentPrisma.$executeRawUnsafe(`INSERT INTO "api_keys" (id, "apiClientId", "keyPrefix", "secretHash") VALUES ('x','x','x','x')`)
    );
  });

  it("products: SELECT sí, INSERT/UPDATE/DELETE no", async () => {
    const rows = await agentPrisma.$queryRawUnsafe(`SELECT * FROM "products" WHERE id = $1`, seeded.productId);
    expect(Array.isArray(rows)).toBe(true);
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`UPDATE "products" SET name = 'x' WHERE id = $1`, seeded.productId));
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`DELETE FROM "products" WHERE id = $1`, seeded.productId));
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`INSERT INTO "products" (id, name, type) VALUES ('x','x','DIGITAL')`));
  });

  it("offers: SELECT sí, INSERT/UPDATE/DELETE no", async () => {
    const rows = await agentPrisma.$queryRawUnsafe(`SELECT * FROM "offers" WHERE id = $1`, seeded.offerId);
    expect(Array.isArray(rows)).toBe(true);
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`UPDATE "offers" SET name = 'x' WHERE id = $1`, seeded.offerId));
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`DELETE FROM "offers" WHERE id = $1`, seeded.offerId));
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`INSERT INTO "offers" (id, "productId", name) VALUES ('x','x','x')`));
  });

  it("prices: SELECT sí, INSERT/UPDATE/DELETE no", async () => {
    const rows = await agentPrisma.$queryRawUnsafe(`SELECT * FROM "prices" WHERE id = $1`, seeded.priceId);
    expect(Array.isArray(rows)).toBe(true);
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`UPDATE "prices" SET amount = 1 WHERE id = $1`, seeded.priceId));
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`DELETE FROM "prices" WHERE id = $1`, seeded.priceId));
    await expectDenied(() =>
      agentPrisma.$executeRawUnsafe(`INSERT INTO "prices" (id, "offerId", amount, currency, interval) VALUES ('x','x',1,'USD','ONE_TIME')`)
    );
  });

  it("pages: SELECT/INSERT/UPDATE sí, DELETE no", async () => {
    const rows = await agentPrisma.$queryRawUnsafe(`SELECT * FROM "pages" WHERE id = $1`, seeded.pageId);
    expect(Array.isArray(rows)).toBe(true);
    await agentPrisma.$executeRawUnsafe(`UPDATE "pages" SET version = version WHERE id = $1`, seeded.pageId);
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`DELETE FROM "pages" WHERE id = $1`, seeded.pageId));
  });

  it("agent_audit_logs: INSERT sí, SELECT/UPDATE/DELETE no", async () => {
    await agentPrisma.$executeRawUnsafe(
      `INSERT INTO "agent_audit_logs" (id, "requestId", "apiClientId", method, "resourceType", "statusCode", "latencyMs", outcome) VALUES ($1,$2,$3,'GET','test',200,1,'ok')`,
      randomUUID(),
      randomUUID(),
      seeded.clientId
    );
    await expectDenied(() => agentPrisma.$queryRawUnsafe(`SELECT * FROM "agent_audit_logs" WHERE "apiClientId" = $1`, seeded.clientId));
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`UPDATE "agent_audit_logs" SET outcome = 'x' WHERE "apiClientId" = $1`, seeded.clientId));
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`DELETE FROM "agent_audit_logs" WHERE "apiClientId" = $1`, seeded.clientId));
  });

  it("api_rate_limit_buckets: SELECT/INSERT/UPDATE sí, DELETE no", async () => {
    const bucketKey = `f8-grants-${randomUUID()}`;
    await agentPrisma.$executeRawUnsafe(
      `INSERT INTO "api_rate_limit_buckets" ("apiKeyId", "bucketKey", "windowStart", count) VALUES ($1,$2,now(),1)`,
      seeded.keyId,
      bucketKey
    );
    const rows = await agentPrisma.$queryRawUnsafe(`SELECT * FROM "api_rate_limit_buckets" WHERE "bucketKey" = $1`, bucketKey);
    expect(Array.isArray(rows)).toBe(true);
    await agentPrisma.$executeRawUnsafe(`UPDATE "api_rate_limit_buckets" SET count = 2 WHERE "bucketKey" = $1`, bucketKey);
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`DELETE FROM "api_rate_limit_buckets" WHERE "bucketKey" = $1`, bucketKey));
    await adminPrisma.$executeRawUnsafe(`DELETE FROM "api_rate_limit_buckets" WHERE "bucketKey" = $1`, bucketKey);
  });

  it("preview_tokens: SELECT/INSERT/UPDATE sí, DELETE no", async () => {
    const tokenId = `pt_${randomUUID()}`;
    await agentPrisma.$executeRawUnsafe(
      `INSERT INTO "preview_tokens" (id, "pageId", "tokenId", "secretHash", "expiresAt") VALUES ($1,$2,$3,'hash', now() + interval '1 day')`,
      randomUUID(),
      seeded.pageId,
      tokenId
    );
    const rows = await agentPrisma.$queryRawUnsafe(`SELECT * FROM "preview_tokens" WHERE "tokenId" = $1`, tokenId);
    expect(Array.isArray(rows)).toBe(true);
    await agentPrisma.$executeRawUnsafe(`UPDATE "preview_tokens" SET "revokedAt" = now() WHERE "tokenId" = $1`, tokenId);
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`DELETE FROM "preview_tokens" WHERE "tokenId" = $1`, tokenId));
    await adminPrisma.$executeRawUnsafe(`DELETE FROM "preview_tokens" WHERE "tokenId" = $1`, tokenId);
  });

  it("idempotency_records: SELECT/INSERT sí, UPDATE/DELETE no", async () => {
    const idempotencyKey = `f8-grants-${randomUUID()}`;
    await agentPrisma.$executeRawUnsafe(
      `INSERT INTO "idempotency_records" (id, "apiClientId", "idempotencyKey", "requestHash", "responseStatus", "responseBody", "expiresAt") VALUES ($1,$2,$3,'hash',200,'{}'::jsonb, now() + interval '1 day')`,
      randomUUID(),
      seeded.clientId,
      idempotencyKey
    );
    const rows = await agentPrisma.$queryRawUnsafe(`SELECT * FROM "idempotency_records" WHERE "idempotencyKey" = $1`, idempotencyKey);
    expect(Array.isArray(rows)).toBe(true);
    await expectDenied(() =>
      agentPrisma.$executeRawUnsafe(`UPDATE "idempotency_records" SET "responseStatus" = 500 WHERE "idempotencyKey" = $1`, idempotencyKey)
    );
    await expectDenied(() => agentPrisma.$executeRawUnsafe(`DELETE FROM "idempotency_records" WHERE "idempotencyKey" = $1`, idempotencyKey));
    await adminPrisma.$executeRawUnsafe(`DELETE FROM "idempotency_records" WHERE "idempotencyKey" = $1`, idempotencyKey);
  });
});
