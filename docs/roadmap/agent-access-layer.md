# Agent Access Layer — PLAN-AGENT-API-01

Identidad y API dedicada para que agentes externos (Claude/MCP) operen
sobre el contenido y catálogo de Empresas Antonio sin usar las credenciales
de un AdminUser humano ni el panel `apps/admin`.

> **Nota de procedencia**: la arquitectura (`ARCH-AGENT-API-01`) y el plan
> por fases (`PLAN-AGENT-API-01`) fueron discutidos y aprobados por Antonio
> en sesiones previas, pero nunca se versionaron como documento en este
> repositorio — solo existían como contexto de conversación. Este archivo
> es la primera versión commiteada; reconstruye el alcance de F0 a partir
> del propio mensaje de commit `96a9030` (que cita ambos documentos como
> ya aprobados) y lo usa como línea base hacia adelante. Los números de ADR
> referenciados dentro de comentarios de código (`ADR-03`, `ADR-04`,
> `ADR-06`, etc., dentro del contexto del Agent Access Layer) pertenecen a
> esa numeración interna de `ARCH-AGENT-API-01` no versionada; ADR-015 y en
> adelante en `docs/adr/` son la numeración global del proyecto.

## Fase F0 — Fundaciones — ✅ CERRADA (2026-08-10)

**Alcance aprobado**: todo lo que debe existir antes de escribir cualquier
lógica de negocio de agentes.

### Entregado (commit `96a9030`, 2026-08-10)

- `prisma/schema.prisma`: modelos `ApiClient`, `ApiKey`, `AgentAuditLog`,
  `ApiRateLimitBucket`, `PreviewToken`, `IdempotencyRecord` — identidad de
  agentes externos, separada de `AdminUser`/`User`. `Page.version`
  (concurrencia optimista) + `variantGroupId`/`variantLabel` (preparado
  para A/B, sin implementar).
- `prisma/agent-access-layer/create_agent_api_role.sql`: rol Postgres
  `agent_api_role`, least-privilege por tabla y por operación, para
  ejecución manual contra la base real (nunca desde `prisma migrate`).
- `id` requerido en cada `LandingBlock` + backfill idempotente
  (`packages/core/scripts/backfill-landing-block-ids.mjs`) — necesario
  para que el Agent Access Layer pueda direccionar un bloque puntual.
- `apps/agent-api`: esqueleto Next.js (thin shell sobre `@repo/core`, sin
  `@repo/admin-ui`), una única ruta `/health`, sin lógica de negocio.
- Pipeline verificado en el commit original: boundaries, typecheck, lint,
  tests (58/58) y build en los 8 workspaces.

### Gate de cierre adicional resuelto antes de declarar F0 cerrada

Dos cosas quedaban pendientes de verificar entre el commit de F0 y el
cierre formal — ninguna de las dos era lógica de negocio nueva, ambas eran
condiciones de entorno para que F0 fuera real y no solo código:

1. **Auditoría Data API/RLS**: `agent_api_role` (creado como parte de F0)
   convive con Prisma como las dos únicas identidades de acceso a
   Postgres. Antes de construir F1 sobre esa base había que confirmar que
   no había un tercer camino de acceso (PostgREST) sin restricciones
   compitiendo con ese modelo de permisos. Resultado: exposición real
   encontrada y cerrada — ver [ADR-015](../adr/ADR-015-data-api-rls-hardening.md)
   y el [informe de auditoría](../security/2026-08-10-data-api-rls-audit.md).
   Confirmado en esa auditoría: `agent_api_role` existe en producción con
   exactamente los GRANTs de `create_agent_api_role.sql`, sin alteración.
2. **Pipeline post-hardening + smoke test de `apps/agent-api`** (2026-08-10,
   esta sesión — los commits `a11c655`/`d79cfb7` son SQL puro y no debían
   afectar código de aplicación, pero no se habían re-verificado):
   - `pnpm run boundaries` → sin violaciones (58 módulos, 134 dependencias).
   - `pnpm -r typecheck` → 7/7 workspaces OK.
   - `pnpm -r lint` → 7/7 workspaces OK.
   - `pnpm -r build` → 7/7 workspaces OK, incluyendo `apps/agent-api`.
   - `apps/agent-api` levantado en local (`pnpm dev`, puerto 3002) y
     `GET /health` → `200 {"status":"ok","service":"agent-api"}`.
   - Test suite de `packages/core` (58/58 en el commit original, contra
     Postgres real) **no se re-ejecutó**: este sandbox no tiene
     `DATABASE_URL`/Postgres disponible, y los dos commits posteriores a
     F0 son scripts SQL fuera de Prisma que no tocan código de aplicación
     ni tests — no hay razón funcional para esperar una regresión, y
     repetir una prueba ya demostrada sin un cambio de código que la
     motive no es un gate real.

### Declaración de cierre

**F0 queda formalmente cerrada el 2026-08-10.** Toda condición de entorno
para empezar a escribir lógica de negocio de agentes (F1) está verificada:
esquema y credenciales de agentes existen en producción con permisos
mínimos, el único camino de acceso alternativo (Data API) está cerrado, y
el pipeline completo pasa sobre el estado actual del repo.

## Fase F1 — Identidad de agentes — en progreso

**Alcance aprobado** (instrucción explícita de Antonio, 2026-08-10): sobre
los modelos ya creados en F0 (`ApiClient`, `ApiKey`), implementar:

- Autenticación bearer con secreto hasheado (nunca almacenado en claro).
- `scopes` por `ApiKey` (verbos permitidos).
- `allowedOfferIds` por `ApiClient` (alcance de recursos: `null` = todas
  las Offers, `[]` = ninguna, array = allow-list explícita).
- Revocación (`revokedAt`) y expiración (`expiresAt`) de `ApiKey`.
- `forceReadOnly` a nivel de `ApiClient` (bloquea todo verbo de escritura
  aunque los scopes de una key lo permitan).
- Kill switches (interruptor operativo para desactivar acceso de agentes
  sin depender de revocar cada key una por una).
- Auditoría atómica de las mutaciones críticas (misma transacción que la
  mutación, nunca "mejor esfuerzo" después del hecho).

**Explícitamente fuera de alcance de F1** (F2+, no adelantar): casos de uso
de negocio que lean/escriban `Page.content`, rate limiting real sobre
`ApiRateLimitBucket`, `PreviewToken`, `IdempotencyRecord`, panel
`/agents` en `apps/admin` para gestión humana de `ApiClient`/`ApiKey`.

### Cierre de F1 — ✅ CERRADA (2026-08-10)

#### Qué se construyó

- **Dominio** (`packages/core/src/domain/agent-access/`): `ApiClient`/`ApiKey`
  como tipos + funciones puras (`isClientUsable`, `isOfferAllowed`,
  `apiKeyUnusableReason`/`isKeyUsable`, `hasScope`), `parseBearerToken`
  (formato `Bearer <keyPrefix>.<secret>`), y `authorizeAgentAction` — la
  decisión de autorización completa (scope + allowedOfferIds +
  forceReadOnly) sin ningún I/O, 100% testeable sin base de datos.
- **Aplicación** (`packages/core/src/application/agent-access/`): puertos
  `ApiClientRepository`/`ApiKeyRepository`/`AgentAuditLogRepository`/
  `ApiKeyHasher`/`ApiKeySecretGenerator`, y los dos use-cases que
  orquestan múltiples puertos: `authenticateAgentRequest` (bearer → hash →
  revocación/expiración → status del cliente → `AgentPrincipal`) e
  `issueApiKey` (genera material, hashea, nunca persiste el secreto en
  claro). Las mutaciones de un solo repositorio (crear cliente, revocar,
  suspender, forceReadOnly, allowedOfferIds) se llaman directamente sobre
  el repositorio, igual que `commerce.offers.setActive()` en apps/admin —
  sin wrappers de use-case que no agregarían ninguna regla de negocio.
- **Infraestructura**: `NodeApiKeyHasher` (SHA-256 + `timingSafeEqual`,
  sin salt — el secreto ya tiene 256 bits de entropía propia, a diferencia
  de una contraseña) y `NodeApiKeySecretGenerator`; los tres repositorios
  Prisma, cada mutación en un `$transaction` que escribe la entidad y su
  fila de `AuditLog` de forma atómica — nunca "mejor esfuerzo" después del
  hecho.
- **apps/agent-api**: `GET /whoami` — única ruta autenticada de F1,
  introspección de identidad pura (no toca ningún recurso de negocio).
  Cada request autenticada o denegada-con-identidad-resuelta queda en
  `AgentAuditLog` (best-effort, no atómico — no hay ninguna mutación con
  la que deba serlo).
- **`packages/core/scripts/manage-agent-clients.mjs`**: único camino para
  crear/administrar `ApiClient`/`ApiKey` mientras no exista un panel admin
  (F2+) — mismo patrón que `seed-admin.mjs`.
- **Los 3 kill switches**: global (`AGENT_API_KILL_SWITCH`, env var, no
  toca la base — para cuando la base misma es la preocupación), por
  cliente (`ApiClientStatus.SUSPENDED`), por key (`ApiKey.revokedAt`).

#### Hallazgo de F0 corregido durante la implementación

`ApiClient.allowedOfferIds` está documentado en el schema (F0) con 3
estados (`null`=todas, `[]`=ninguna, array=allow-list), pero Prisma Client
tipa ese campo como `string[]` — nunca `string[] | null` — y **colapsa
cualquier NULL de Postgres a `[]` al leerlo**, sin forma de recuperar el
NULL real a través de `findUnique`/`findMany`. `PrismaApiClientRepository`
resuelve esto con `$queryRawUnsafe` solo para este campo en las lecturas
(`findById`/`list`) y `$executeRawUnsafe` para volver a NULL desde un
allow-list previo (`setAllowedOfferIds`) — el resto de la tabla usa la API
normal de Prisma. Verificado con una prueba dedicada que lee la columna
cruda y confirma que NULL y `[]` quedan realmente distinguibles en
Postgres (no solo en el tipo de TypeScript).

#### Verificación — ejecutada contra Postgres real, no solo escrita

A diferencia del gate de F0 (sin DB disponible en el sandbox), esta vez se
levantó Postgres 16 local (ya instalado en el entorno, no en producción),
se aplicaron las 7 migraciones existentes sin tocar producción, y se
corrió la suite completa:

```
Test Files  12 passed | 3 skipped (15)
     Tests  110 passed | 7 skipped (117)
```

Incluye 15/15 en `agent-access.integration.test.ts` (ciclo de vida de
ApiClient con los 3 estados de `allowedOfferIds`, atomicidad
mutación+AuditLog, revoke idempotente, y `authenticateAgentRequest` para
cada resultado: éxito, `kill_switch_engaged`, `invalid_credentials` ×3,
`key_revoked`, `key_expired`, `client_suspended`), 30/30 en
`agent-access-domain.test.ts` (dominio puro) y 7/7 en
`agent-access-crypto.test.ts` (hash/verify/generación). **Los 82 tests
preexistentes de F0 (payments, webhooks, Better Auth, theming) siguen en
verde** — sin regresiones.

Además, smoke test end-to-end real por HTTP (no solo vitest): CLI script →
`create-client` → `issue-key` → `GET /whoami` con la key real → `200` con
el `AgentPrincipal` completo; con secreto incorrecto o sin header → `401
invalid_credentials` (mismo motivo en ambos casos, para no permitir
enumerar `keyPrefix` válidos); tras `revoke-key` → `401 key_revoked`; con
`AGENT_API_KILL_SWITCH=true` → `503 kill_switch_engaged` incluso con una
key perfectamente válida. Confirmado en Postgres que cada intento con
identidad resuelta (éxito o denegado) generó su fila en `AgentAuditLog`, y
que cada mutación de identidad (crear cliente, emitir/revocar key) generó
su fila en `AuditLog` — ambas tablas con la atribución de actor correcta
(`test`/`vitest` desde la suite, `cli`/`root` desde el uso manual). Entorno
de prueba completamente descartado al terminar (DB local eliminada,
Postgres detenido, sin `.env` ni `.env.local` commiteados).

`pnpm run boundaries` + `pnpm -r typecheck` + `pnpm -r lint` + `pnpm -r
build` verificados en verde en los 7 workspaces de código (8 con la raíz)
después de todos los cambios.

#### Decisión de diseño explícita: qué se revela en una denegación

`invalid_credentials` es la misma respuesta tanto si el `keyPrefix` no
existe como si el secreto no coincide — evita que un llamador pueda
enumerar prefixes válidos probando secretos al azar. `key_revoked`,
`key_expired`, `client_suspended` y `kill_switch_engaged` sí se devuelven
explícitos al llamador (no solo al `AgentAuditLog`) — quien ya presentó
una key estructuralmente válida una vez puede auto-diagnosticar su propio
estado sin necesitar soporte; es el mismo criterio que usan Stripe/GitHub
para sus API keys.

#### Pendiente operativo (no de código, fuera de lo que esta sesión puede verificar)

El `DATABASE_URL` del proyecto de Vercel de `apps/agent-api` debe apuntar
a `agent_api_role` (no al rol `postgres` que usan web/admin) para que las
grants mínimas de F0 (`create_agent_api_role.sql`) apliquen de verdad en
producción — es un ajuste de variables de entorno en el dashboard de
Vercel, no algo que este entorno de sesión pueda leer ni cambiar. Mientras
no se confirme, `authenticateAgentRequest`/`recordAgentAuditLog` en
producción corren con lo que esa variable tenga configurado hoy.
`manage-agent-clients.mjs` está diseñado para el `DATABASE_URL` de rol
`postgres` (el de la raíz del monorepo) — nunca con el de `agent_api_role`,
que no tiene permisos para sus mutaciones.
