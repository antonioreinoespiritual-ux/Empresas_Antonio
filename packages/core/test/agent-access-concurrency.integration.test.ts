import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createFixtureOffer } from "./fixtures";
import {
  IdempotencyConflictError,
  RateLimitExceededError,
  VersionConflictError,
} from "../src/domain";
import { enforceRateLimit, executeAgentPageWrite, savePageContent, withIdempotency } from "../src/application";
import {
  NodeApiKeyHasher,
  PrismaApiClientRepository,
  PrismaApiKeyRepository,
  PrismaIdempotencyRecordRepository,
  PrismaPageRepository,
  PrismaRateLimitBucketRepository,
  hashRequestPayload,
} from "../src/infrastructure";
import { prisma } from "../src/infrastructure/prisma/client";

// Requiere Postgres real vía DATABASE_URL (ver test/setup.ts) — no
// ejecutable en un sandbox sin base de datos. Cada `Promise.all` de abajo
// dispara llamadas realmente concurrentes contra Postgres: la garantía que
// se prueba vive en las sentencias atómicas de Postgres (row locks,
// UNIQUE, UPDATE...WHERE...RETURNING), no en ninguna serialización de
// JavaScript — si el mecanismo fuera "leer, decidir, escribir" en pasos
// separados, estos tests fallarían de forma intermitente bajo carga real.

const pages = new PrismaPageRepository();
const rateLimits = new PrismaRateLimitBucketRepository();
const idempotency = new PrismaIdempotencyRecordRepository();
const apiClients = new PrismaApiClientRepository();
const apiKeys = new PrismaApiKeyRepository();
const hasher = new NodeApiKeyHasher();
const actor = { actorType: "test", actorId: "vitest-concurrency" };

async function createTestAgentIdentity() {
  const admin = await prisma.adminUser.create({ data: { email: `admin-${randomUUID()}@test.local`, name: "Test Admin" } });
  const client = await apiClients.create({ name: `Cliente concurrencia ${randomUUID()}`, createdByAdminId: admin.id }, actor);
  const issued = await apiKeys.issue(
    { apiClientId: client.id, keyPrefix: `ak_${randomUUID()}`, secretHash: hasher.hash("irrelevante-en-estos-tests"), scopes: ["pages:write"] },
    actor
  );
  return { apiClientId: client.id, apiKeyId: issued.id };
}

async function createTestLandingPage() {
  const { offer } = await createFixtureOffer();
  const page = await pages.createInitial({ offerId: offer.id, kind: "LANDING", content: { heroTitle: "Versión inicial" } });
  return { offer, page };
}

describe("CAS de Page.version: dos escrituras simultáneas con la misma version", () => {
  it("exactamente una gana; la otra recibe VersionConflictError, nunca una pérdida silenciosa", async () => {
    const { offer, page } = await createTestLandingPage();
    expect(page.version).toBe(1);

    const attempt = (label: string) =>
      savePageContent(
        { pages },
        { offerId: offer.id, kind: "LANDING", content: { heroTitle: label }, expectedVersion: 1 }
      );

    const results = await Promise.allSettled([attempt("Escritura A"), attempt("Escritura B")]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(VersionConflictError);

    const final = await pages.findByOfferAndKind(offer.id, "LANDING");
    expect(final?.version).toBe(2); // incrementó exactamente una vez, no dos.
    // El contenido final es el de la escritura que ganó — nunca un tercer
    // estado mezclado ni el estado inicial (eso sería la pérdida silenciosa).
    expect(["Escritura A", "Escritura B"]).toContain((final?.content as { heroTitle: string }).heroTitle);
  });

  it("10 escrituras concurrentes con la misma version: exactamente una gana", async () => {
    const { offer, page } = await createTestLandingPage();

    const attempts = Array.from({ length: 10 }, (_, i) =>
      savePageContent({ pages }, { offerId: offer.id, kind: "LANDING", content: { heroTitle: `intento-${i}` }, expectedVersion: page.version })
    );
    const results = await Promise.allSettled(attempts);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(9);
    for (const r of results) {
      if (r.status === "rejected") expect(r.reason).toBeInstanceOf(VersionConflictError);
    }

    const final = await pages.findByOfferAndKind(offer.id, "LANDING");
    expect(final?.version).toBe(page.version + 1);
  });
});

describe("Admin vs. operación concurrente sobre la misma Page: jamás pérdida silenciosa", () => {
  it("un guardado del panel admin (updateWithVersion) y uno de un agente (updateWithVersionAudited) compitiendo por la misma version: exactamente uno gana", async () => {
    const { offer, page } = await createTestLandingPage();
    const { apiClientId, apiKeyId } = await createTestAgentIdentity();

    const adminWrite = pages.updateWithVersion({
      offerId: offer.id,
      kind: "LANDING",
      content: { heroTitle: "Editado por admin" },
      expectedVersion: page.version,
    });
    const agentWrite = pages.updateWithVersionAudited(
      { offerId: offer.id, kind: "LANDING", content: { heroTitle: "Editado por agente" }, expectedVersion: page.version },
      { requestId: randomUUID(), apiClientId, apiKeyId }
    );

    const [adminResult, agentResult] = await Promise.allSettled([adminWrite, agentWrite]);
    const outcomes = [adminResult, agentResult];
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);

    const final = await pages.findByOfferAndKind(offer.id, "LANDING");
    expect(final?.version).toBe(page.version + 1);

    // Si ganó el agente, tiene que existir su AgentAuditLog; si ganó el
    // admin, NO debe existir ningún AgentAuditLog para esta Page (el admin
    // no pasa por ese camino) — en ningún caso queda en un estado ambiguo.
    const agentWon = agentResult.status === "fulfilled";
    const auditCount = await prisma.agentAuditLog.count({ where: { resourceType: "Page", resourceId: page.id } });
    expect(auditCount).toBe(agentWon ? 1 : 0);
    expect((final?.content as { heroTitle: string }).heroTitle).toBe(agentWon ? "Editado por agente" : "Editado por admin");
  });
});

describe("Rate limit atómico: imposible superar el límite bajo concurrencia real", () => {
  it("con límite 5 y 20 llamadas concurrentes, exactamente 5 pasan y 15 se rechazan", async () => {
    const apiKeyId = randomUUID();
    const now = new Date();
    const limit = 5;

    const calls = Array.from({ length: 20 }, () =>
      enforceRateLimit({ rateLimits }, { apiKeyId, routeKey: "concurrency-test", limit, windowMs: 60_000, now })
    );
    const results = await Promise.allSettled(calls);

    const allowed = results.filter((r) => r.status === "fulfilled");
    const denied = results.filter((r) => r.status === "rejected");
    expect(allowed).toHaveLength(limit);
    expect(denied).toHaveLength(20 - limit);
    for (const r of denied) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(RateLimitExceededError);
    }

    // Los `count` devueltos a los que pasaron son exactamente 1..5, sin
    // huecos ni repetidos — prueba que Postgres serializó los incrementos.
    const allowedCounts = allowed.map((r) => (r as PromiseFulfilledResult<{ count: number }>).value.count).sort((a, b) => a - b);
    expect(allowedCounts).toEqual([1, 2, 3, 4, 5]);
  });

  it("una ventana nueva no hereda el conteo de la ventana anterior", async () => {
    const apiKeyId = randomUUID();
    const windowMs = 1000;
    const t0 = new Date(2026, 0, 1, 0, 0, 0, 0);
    const t1 = new Date(t0.getTime() + windowMs); // siguiente ventana exacta

    for (let i = 0; i < 3; i += 1) {
      await enforceRateLimit({ rateLimits }, { apiKeyId, routeKey: "window-test", limit: 3, windowMs, now: t0 });
    }
    // La 4ª en la misma ventana debe rechazarse.
    await expect(
      enforceRateLimit({ rateLimits }, { apiKeyId, routeKey: "window-test", limit: 3, windowMs, now: t0 })
    ).rejects.toBeInstanceOf(RateLimitExceededError);

    // En la ventana siguiente, el conteo arranca de nuevo en 1.
    const status = await enforceRateLimit({ rateLimits }, { apiKeyId, routeKey: "window-test", limit: 3, windowMs, now: t1 });
    expect(status.count).toBe(1);
  });
});

describe("Idempotencia: misma key + mismo payload vs. mismo key + payload distinto", () => {
  it("10 llamadas concurrentes con la misma key y el mismo payload ejecutan la mutación una sola vez y devuelven el mismo resultado", async () => {
    const apiClientId = randomUUID();
    const idempotencyKey = randomUUID();
    const requestHash = hashRequestPayload({ foo: "bar" });
    let executions = 0;

    const call = () =>
      withIdempotency(
        { idempotency },
        { apiClientId, idempotencyKey, requestHash, ttlMs: 60_000, now: new Date() },
        async () => {
          executions += 1;
          await new Promise((resolve) => setTimeout(resolve, 30)); // simula trabajo real, amplía la ventana de carrera
          return { status: 201, body: { createdId: "solo-una-vez" } };
        }
      );

    const results = await Promise.all(Array.from({ length: 10 }, call));

    expect(executions).toBe(1);
    for (const result of results) {
      expect(result.status).toBe(201);
      expect(result.body).toEqual({ createdId: "solo-una-vez" });
    }
    expect(results.filter((r) => r.executed)).toHaveLength(1);
    expect(results.filter((r) => !r.executed)).toHaveLength(9);
  });

  it("misma key con un payload distinto se rechaza con IdempotencyConflictError, nunca se ejecuta silenciosamente", async () => {
    const apiClientId = randomUUID();
    const idempotencyKey = randomUUID();

    await withIdempotency(
      { idempotency },
      { apiClientId, idempotencyKey, requestHash: hashRequestPayload({ v: 1 }), ttlMs: 60_000, now: new Date() },
      async () => ({ status: 200, body: { ok: true } })
    );

    await expect(
      withIdempotency(
        { idempotency },
        { apiClientId, idempotencyKey, requestHash: hashRequestPayload({ v: 2 }), ttlMs: 60_000, now: new Date() },
        async () => ({ status: 200, body: { ok: true, mutatedAgain: true } })
      )
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it("una excepción inesperada en execute() finaliza el registro (nunca queda trabado) y se relanza al llamador original", async () => {
    const apiClientId = randomUUID();
    const idempotencyKey = randomUUID();
    const requestHash = hashRequestPayload({ boom: true });

    await expect(
      withIdempotency({ idempotency }, { apiClientId, idempotencyKey, requestHash, ttlMs: 60_000, now: new Date() }, async () => {
        throw new Error("fallo inesperado");
      })
    ).rejects.toThrow("fallo inesperado");

    const record = await idempotency.findByKey(apiClientId, idempotencyKey);
    expect(record?.responseStatus).toBe(500);
  });
});

describe("Mutación crítica + auditoría: mismo commit o mismo rollback", () => {
  it("una escritura exitosa de agente deja exactamente la Page nueva Y su AgentAuditLog", async () => {
    const { offer, page } = await createTestLandingPage();
    const { apiClientId, apiKeyId } = await createTestAgentIdentity();
    const requestId = randomUUID();

    const updated = await pages.updateWithVersionAudited(
      { offerId: offer.id, kind: "LANDING", content: { heroTitle: "Auditado" }, expectedVersion: page.version },
      { requestId, apiClientId, apiKeyId }
    );

    expect(updated.version).toBe(page.version + 1);
    const auditEntry = await prisma.agentAuditLog.findFirst({ where: { requestId } });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry?.resourceId).toBe(page.id);
    expect(auditEntry?.apiClientId).toBe(apiClientId);
  });

  it("un conflicto de versión no deja ningún AgentAuditLog huérfano (rollback conjunto)", async () => {
    const { offer, page } = await createTestLandingPage();
    const { apiClientId, apiKeyId } = await createTestAgentIdentity();
    const requestId = randomUUID();

    // expectedVersion incorrecta a propósito -> la CAS falla adentro de la
    // misma transacción que el INSERT de AgentAuditLog.
    await expect(
      pages.updateWithVersionAudited(
        { offerId: offer.id, kind: "LANDING", content: { heroTitle: "No debería persistir" }, expectedVersion: page.version + 99 },
        { requestId, apiClientId, apiKeyId }
      )
    ).rejects.toBeInstanceOf(VersionConflictError);

    const auditEntry = await prisma.agentAuditLog.findFirst({ where: { requestId } });
    expect(auditEntry).toBeNull();
    const untouched = await pages.findByOfferAndKind(offer.id, "LANDING");
    expect(untouched?.version).toBe(page.version);
  });

  it("executeAgentPageWrite (rate limit + idempotencia + CAS + auditoría) compone las 4 garantías en una sola llamada", async () => {
    const { offer, page } = await createTestLandingPage();
    const { apiClientId, apiKeyId } = await createTestAgentIdentity();
    const idempotencyKey = randomUUID();
    const payload = { offerId: offer.id, kind: "LANDING" as const, content: { heroTitle: "Vía executeAgentPageWrite" }, expectedVersion: page.version };

    const result = await executeAgentPageWrite(
      { pages, rateLimits, idempotency },
      {
        requestId: randomUUID(),
        apiClientId,
        apiKeyId,
        idempotencyKey,
        requestHash: hashRequestPayload(payload),
        now: new Date(),
        rateLimit: { limit: 10, windowMs: 60_000 },
        idempotencyTtlMs: 60_000,
        page: payload,
      }
    );

    expect(result.status).toBe(200);
    expect(result.executed).toBe(true);
    expect(result.body.page?.version).toBe(page.version + 1);

    // Reintentar con la misma key + mismo payload (p. ej. el cliente no
    // recibió la respuesta y reintenta) devuelve el mismo resultado
    // cacheado, sin volver a incrementar version.
    const retry = await executeAgentPageWrite(
      { pages, rateLimits, idempotency },
      {
        requestId: randomUUID(),
        apiClientId,
        apiKeyId,
        idempotencyKey,
        requestHash: hashRequestPayload(payload),
        now: new Date(),
        rateLimit: { limit: 10, windowMs: 60_000 },
        idempotencyTtlMs: 60_000,
        page: payload,
      }
    );
    expect(retry.executed).toBe(false);
    expect(retry.status).toBe(200);
    expect(retry.body.page?.version).toBe(page.version + 1); // no volvió a incrementar
  });

  // Fase 7 (ARCH-LANDING-EDITOR-02, "modo código" — P-3 resuelta: alcance A,
  // sin evaluador de expresiones): escribir el JSON completo de Composition
  // vía executeAgentPageWrite (el mismo camino de PATCH /pages/:id, sin
  // pasar por los endpoints granulares /nodes) ya funcionaba desde Fase 3 —
  // este test cierra el único hueco real: nunca se había probado
  // directamente el rechazo de una Composition inválida enviada como JSON
  // completo (los tests de Fase 3 solo cubrían rechazo vía /nodes).
  it("rechaza una Composition inválida enviada como JSON completo (una section sin ninguna row) sin dejar Page ni AgentAuditLog huérfanos", async () => {
    const { offer, page } = await createTestLandingPage();
    const { apiClientId, apiKeyId } = await createTestAgentIdentity();
    const requestId = randomUUID();
    const invalidComposition = { version: "composition-1", root: [{ type: "section", id: "sec-1", children: [] }] };
    const payload = { offerId: offer.id, kind: "LANDING" as const, content: invalidComposition, expectedVersion: page.version };

    const result = await executeAgentPageWrite(
      { pages, rateLimits, idempotency },
      {
        requestId,
        apiClientId,
        apiKeyId,
        idempotencyKey: randomUUID(),
        requestHash: hashRequestPayload(payload),
        now: new Date(),
        rateLimit: { limit: 10, windowMs: 60_000 },
        idempotencyTtlMs: 60_000,
        page: payload,
      }
    );

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ error: "invalid_content" });
    const auditEntry = await prisma.agentAuditLog.findFirst({ where: { requestId } });
    expect(auditEntry).toBeNull();
    const untouched = await pages.findByOfferAndKind(offer.id, "LANDING");
    expect(untouched?.version).toBe(page.version);
  });

  it("un agente construye, en una sola escritura de JSON completo, una Composition más elaborada de lo que el editor visual 6a arma en un paso (gate de cierre de Fase 7)", async () => {
    const { offer, page } = await createTestLandingPage();
    const { apiClientId, apiKeyId } = await createTestAgentIdentity();
    // Tres sections con dos rows cada una (una de ellas con una row anidada,
    // P-1 nivel 4) en una sola llamada — 6a solo permite agregar un nodo por
    // vez desde la UI, nunca un árbol entero de un saque.
    const elaborateComposition = {
      version: "composition-1",
      root: Array.from({ length: 3 }, (_, sectionIndex) => ({
        type: "section" as const,
        id: `sec-${sectionIndex}`,
        children: [
          {
            type: "row" as const,
            id: `row-${sectionIndex}-0`,
            children: [
              { type: "richText" as const, id: `rt-${sectionIndex}`, content: [{ style: "p" as const, children: [{ text: `Sección ${sectionIndex}`, marks: [] }] }] },
              {
                type: "row" as const,
                id: `row-${sectionIndex}-inner`,
                children: [{ type: "divider" as const, id: `div-${sectionIndex}`, content: {} }],
              },
            ],
          },
          { type: "row" as const, id: `row-${sectionIndex}-1`, children: [{ type: "spacer" as const, id: `sp-${sectionIndex}`, content: {} }] },
        ],
      })),
    };
    const payload = { offerId: offer.id, kind: "LANDING" as const, content: elaborateComposition, expectedVersion: page.version };

    const result = await executeAgentPageWrite(
      { pages, rateLimits, idempotency },
      {
        requestId: randomUUID(),
        apiClientId,
        apiKeyId,
        idempotencyKey: randomUUID(),
        requestHash: hashRequestPayload(payload),
        now: new Date(),
        rateLimit: { limit: 10, windowMs: 60_000 },
        idempotencyTtlMs: 60_000,
        page: payload,
      }
    );

    expect(result.status).toBe(200);
    expect(result.body.page?.content).toEqual(elaborateComposition);
    const persisted = await pages.findByOfferAndKind(offer.id, "LANDING");
    expect(persisted?.content).toEqual(elaborateComposition);
  });

  // F8 (PLAN-AGENT-API-01, ítems 45-58): "atomicidad de auditoría bajo
  // carga: toda mutación crítica exitosa tiene su fila de auditoría
  // correspondiente, sin excepción, verificado con concurrencia real". Los
  // dos tests de arriba ya prueban la atomicidad de UNA escritura a la vez
  // — este dispara 40 escrituras realmente concurrentes (20 exitosas sobre
  // Pages distintas + 20 que compiten por CAS sobre una misma Page, la
  // mitad de las cuales debe perder) y verifica en conjunto, después de que
  // todo terminó, que no hay ni un solo caso de "Page nueva sin su
  // AgentAuditLog" ni "AgentAuditLog sin su Page" bajo carga real.
  it("bajo 40 escrituras concurrentes reales (exitosas + en conflicto), cada éxito tiene exactamente su AgentAuditLog y ningún conflicto deja huérfanos", async () => {
    const { apiClientId, apiKeyId } = await createTestAgentIdentity();

    const independentWrites = await Promise.all(
      Array.from({ length: 20 }, async () => {
        const { offer, page } = await createTestLandingPage();
        const requestId = randomUUID();
        const result = await pages
          .updateWithVersionAudited(
            { offerId: offer.id, kind: "LANDING", content: { heroTitle: "Carga concurrente" }, expectedVersion: page.version },
            { requestId, apiClientId, apiKeyId }
          )
          .then(() => "fulfilled" as const)
          .catch(() => "rejected" as const);
        return { requestId, expectedOutcome: "success" as const, settled: result };
      })
    );

    const { offer: sharedOffer, page: sharedPage } = await createTestLandingPage();
    const competingWrites = await Promise.all(
      Array.from({ length: 20 }, async () => {
        const requestId = randomUUID();
        const settled = await pages
          .updateWithVersionAudited(
            { offerId: sharedOffer.id, kind: "LANDING", content: { heroTitle: "Compitiendo por CAS" }, expectedVersion: sharedPage.version },
            { requestId, apiClientId, apiKeyId }
          )
          .then(() => "fulfilled" as const)
          .catch((error) => (error instanceof VersionConflictError ? ("rejected" as const) : Promise.reject(error)));
        return { requestId, settled };
      })
    );

    const allResults = [...independentWrites, ...competingWrites];
    const successfulRequestIds = allResults.filter((r) => r.settled === "fulfilled").map((r) => r.requestId);
    const failedRequestIds = allResults.filter((r) => r.settled === "rejected").map((r) => r.requestId);

    // Las 20 escrituras independientes debieron tener éxito todas (Pages
    // distintas, sin contención real entre ellas); de las 20 que compiten
    // por la misma Page, exactamente una gana el CAS y las otras 19 pierden
    // — nunca más de una, nunca cero.
    const successfulCompeting = competingWrites.filter((r) => r.settled === "fulfilled");
    expect(successfulCompeting).toHaveLength(1);
    expect(successfulRequestIds).toHaveLength(21); // 20 independientes + 1 ganador de la competencia
    expect(failedRequestIds).toHaveLength(19);

    const auditEntriesForSuccesses = await prisma.agentAuditLog.findMany({ where: { requestId: { in: successfulRequestIds } } });
    expect(auditEntriesForSuccesses).toHaveLength(successfulRequestIds.length); // ni uno de más, ni uno de menos

    const auditEntriesForFailures = await prisma.agentAuditLog.findMany({ where: { requestId: { in: failedRequestIds } } });
    expect(auditEntriesForFailures).toHaveLength(0); // ningún conflicto dejó un AgentAuditLog huérfano
  });
});
