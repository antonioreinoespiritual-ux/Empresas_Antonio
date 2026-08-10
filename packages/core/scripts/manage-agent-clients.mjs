// Gestión de identidad de agentes (ApiClient/ApiKey) — Agent Access Layer,
// F1. No existe todavía un panel /agents en apps/admin (explícitamente
// fuera de alcance de F1, ver docs/roadmap/agent-access-layer.md) — este
// script es el único camino para crear/administrar credenciales de agentes,
// igual que seed-admin.mjs es el único camino para crear un AdminUser.
//
// Corre con el DATABASE_URL de rol `postgres` (el de la raíz del monorepo),
// nunca con el de `agent_api_role` — ese rol no tiene INSERT/UPDATE sobre
// api_clients/api_keys ni ningún permiso sobre audit_logs (ver
// prisma/agent-access-layer/create_agent_api_role.sql).
//
// Duplica en JS plano el hash de secreto (SHA-256) y la lógica de
// auditoría atómica que packages/core/src/infrastructure/agent-access y
// .../prisma/repositories/api-{client,key}.repository.ts implementan en
// TypeScript para apps/agent-api — igual que el resto de scripts/*.mjs de
// este repo, que no importan código TS de src/ (no hay paso de build para
// estos scripts, solo Node + @prisma/client).
//
// Uso:
//   node --env-file=.env packages/core/scripts/manage-agent-clients.mjs <comando> [flags]
//
// Comandos:
//   create-client --name "<nombre>" --created-by-admin-id <id>
//                 [--description "<texto>"] [--allowed-offer-ids id1,id2] [--force-read-only]
//   issue-key --client-id <id> [--scopes scope1,scope2] [--expires-in-days <n>]
//   revoke-key --key-id <id>
//   set-status --client-id <id> --status ACTIVE|SUSPENDED
//   set-force-read-only --client-id <id> --value true|false
//   set-allowed-offer-ids --client-id <id> (--allowed-offer-ids id1,id2 | --all)
//   list-clients
import { createHash, randomBytes } from "node:crypto";
import { userInfo } from "node:os";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[key] = true; // flags booleanas sin valor, p. ej. --force-read-only
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return { command, flags };
}

function actorFromEnv() {
  return { actorType: "cli", actorId: process.env.AGENT_CLI_ACTOR_ID || userInfo().username || "unknown" };
}

function hashSecret(secret) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function generateKeyMaterial() {
  return {
    keyPrefix: `ak_${randomBytes(9).toString("base64url")}`,
    secret: randomBytes(32).toString("base64url"),
  };
}

function splitCsv(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function createClient(flags) {
  if (!flags.name || !flags["created-by-admin-id"]) {
    throw new Error("create-client requiere --name y --created-by-admin-id");
  }
  const allowedOfferIds = flags["allowed-offer-ids"] ? splitCsv(flags["allowed-offer-ids"]) : undefined;
  const actor = actorFromEnv();

  const client = await prisma.$transaction(async (tx) => {
    const created = await tx.apiClient.create({
      data: {
        name: flags.name,
        description: flags.description ?? null,
        forceReadOnly: Boolean(flags["force-read-only"]),
        createdByAdminId: flags["created-by-admin-id"],
        ...(allowedOfferIds !== undefined ? { allowedOfferIds } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "api_client.created",
        entity: "ApiClient",
        entityId: created.id,
        diff: { name: created.name, forceReadOnly: created.forceReadOnly, allowedOfferIds: allowedOfferIds ?? null },
      },
    });
    return created;
  });

  console.log(`ApiClient creado: ${client.id} (${client.name}). allowedOfferIds=${JSON.stringify(allowedOfferIds ?? null)}`);
}

async function issueKey(flags) {
  if (!flags["client-id"]) throw new Error("issue-key requiere --client-id");
  const client = await prisma.apiClient.findUnique({ where: { id: flags["client-id"] } });
  if (!client) throw new Error(`ApiClient ${flags["client-id"]} no existe`);

  const scopes = flags.scopes ? splitCsv(flags.scopes) : [];
  const expiresAt = flags["expires-in-days"]
    ? new Date(Date.now() + Number(flags["expires-in-days"]) * 24 * 60 * 60 * 1000)
    : null;
  const material = generateKeyMaterial();
  const secretHash = hashSecret(material.secret);
  const actor = actorFromEnv();

  const key = await prisma.$transaction(async (tx) => {
    const created = await tx.apiKey.create({
      data: {
        apiClientId: client.id,
        keyPrefix: material.keyPrefix,
        secretHash,
        scopes,
        expiresAt,
      },
    });
    await tx.auditLog.create({
      data: {
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "api_key.issued",
        entity: "ApiKey",
        entityId: created.id,
        diff: { apiClientId: client.id, keyPrefix: created.keyPrefix, scopes, expiresAt },
      },
    });
    return created;
  });

  console.log(`ApiKey emitida: ${key.id} para ApiClient ${client.id}.`);
  console.log(`Secreto en claro (guardalo ahora — no se puede recuperar después):`);
  console.log(`  ${material.keyPrefix}.${material.secret}`);
}

async function revokeKey(flags) {
  if (!flags["key-id"]) throw new Error("revoke-key requiere --key-id");
  const actor = actorFromEnv();

  await prisma.$transaction(async (tx) => {
    const key = await tx.apiKey.findUniqueOrThrow({ where: { id: flags["key-id"] } });
    if (key.revokedAt !== null) {
      console.log(`ApiKey ${key.id} ya estaba revocada (${key.revokedAt.toISOString()}). No-op.`);
      return;
    }
    const revoked = await tx.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({
      data: {
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "api_key.revoked",
        entity: "ApiKey",
        entityId: key.id,
        diff: { revokedAt: revoked.revokedAt },
      },
    });
    console.log(`ApiKey ${key.id} revocada.`);
  });
}

async function setStatus(flags) {
  if (!flags["client-id"] || !flags.status) throw new Error("set-status requiere --client-id y --status");
  if (!["ACTIVE", "SUSPENDED"].includes(flags.status)) throw new Error("--status debe ser ACTIVE o SUSPENDED");
  const actor = actorFromEnv();

  await prisma.$transaction(async (tx) => {
    await tx.apiClient.update({ where: { id: flags["client-id"] }, data: { status: flags.status } });
    await tx.auditLog.create({
      data: {
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "api_client.status_changed",
        entity: "ApiClient",
        entityId: flags["client-id"],
        diff: { status: flags.status },
      },
    });
  });

  console.log(`ApiClient ${flags["client-id"]} -> status=${flags.status}${flags.status === "SUSPENDED" ? " (kill switch por cliente activado)" : ""}.`);
}

async function setForceReadOnly(flags) {
  if (!flags["client-id"] || flags.value === undefined) {
    throw new Error("set-force-read-only requiere --client-id y --value true|false");
  }
  const forceReadOnly = flags.value === "true" || flags.value === true;
  const actor = actorFromEnv();

  await prisma.$transaction(async (tx) => {
    await tx.apiClient.update({ where: { id: flags["client-id"] }, data: { forceReadOnly } });
    await tx.auditLog.create({
      data: {
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "api_client.force_read_only_changed",
        entity: "ApiClient",
        entityId: flags["client-id"],
        diff: { forceReadOnly },
      },
    });
  });

  console.log(`ApiClient ${flags["client-id"]} -> forceReadOnly=${forceReadOnly}.`);
}

async function setAllowedOfferIds(flags) {
  if (!flags["client-id"]) throw new Error("set-allowed-offer-ids requiere --client-id");
  if (!flags["allowed-offer-ids"] && !flags.all) {
    throw new Error("set-allowed-offer-ids requiere --allowed-offer-ids id1,id2 o --all (todas las Offers)");
  }
  const allowedOfferIds = flags.all ? null : splitCsv(flags["allowed-offer-ids"]);
  const actor = actorFromEnv();

  await prisma.$transaction(async (tx) => {
    if (allowedOfferIds === null) {
      // Prisma no puede escribir `null` en este campo vía su API tipada
      // (ver comentario en PrismaApiClientRepository) — SQL crudo acá también.
      await tx.$executeRawUnsafe(
        `UPDATE "api_clients" SET "allowedOfferIds" = NULL, "updatedAt" = now() WHERE "id" = $1`,
        flags["client-id"]
      );
    } else {
      await tx.apiClient.update({ where: { id: flags["client-id"] }, data: { allowedOfferIds, updatedAt: new Date() } });
    }
    await tx.auditLog.create({
      data: {
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "api_client.allowed_offer_ids_changed",
        entity: "ApiClient",
        entityId: flags["client-id"],
        diff: { allowedOfferIds },
      },
    });
  });

  console.log(`ApiClient ${flags["client-id"]} -> allowedOfferIds=${JSON.stringify(allowedOfferIds)}.`);
}

async function listClients() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "id", "name", "status", "forceReadOnly", "allowedOfferIds", "createdAt"
     FROM "api_clients" ORDER BY "createdAt" DESC`
  );
  for (const row of rows) {
    console.log(
      `${row.id}  ${row.name}  status=${row.status}  forceReadOnly=${row.forceReadOnly}  allowedOfferIds=${JSON.stringify(row.allowedOfferIds)}`
    );
  }
  if (rows.length === 0) console.log("(sin ApiClients)");
}

const COMMANDS = {
  "create-client": createClient,
  "issue-key": issueKey,
  "revoke-key": revokeKey,
  "set-status": setStatus,
  "set-force-read-only": setForceReadOnly,
  "set-allowed-offer-ids": setAllowedOfferIds,
  "list-clients": listClients,
};

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`Comando desconocido: "${command ?? ""}". Comandos: ${Object.keys(COMMANDS).join(", ")}`);
    process.exit(1);
  }
  try {
    await handler(flags);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
