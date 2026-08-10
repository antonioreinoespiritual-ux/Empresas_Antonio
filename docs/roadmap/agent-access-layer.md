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

### Cierre operativo de F1 — ⏳ en curso (2026-08-10)

Auditoría de esta misma sesión: `apps/agent-api` **nunca se había
desplegado a Vercel** — solo existían `empresas-antonio-admin` y
`empresas-antonio-web` en la cuenta (`leonel8`). El cierre "técnico" de F1
(código + tests) no implicaba que el aislamiento de `agent_api_role`
existiera de verdad en producción, porque no había ningún runtime
corriendo con esa credencial.

Avance de esta sesión:

1. Password de `agent_api_role` rotada en el proyecto Supabase real
   (`empresas-antonio`, `gbcghkfhgikrlisxexig`) — el valor anterior nunca
   estuvo disponible para esta sesión (era un placeholder manual de F0);
   el nuevo se generó, se aplicó vía `ALTER ROLE`, y se entregó una única
   vez a Antonio fuera de este documento (nunca escrito en el repo).
2. Ruta temporal `GET /internal/role-check` (commit `384fe97`),
   deshabilitada por defecto (404 sin `AGENT_API_ROLE_CHECK_TOKEN`) —
   confirma desde el runtime real `current_user`/`session_user` y hace un
   SELECT de prueba contra una tabla con GRANT (`products`) y otra sin
   GRANT (`admin_users`), sin devolver ninguna fila de datos.
3. Instrucciones exactas (`DATABASE_URL`/`DIRECT_URL` vía pooler Supavisor
   transacción, `agent_api_role.<project_ref>@aws-0-us-east-1.pooler.supabase.com:6543`)
   entregadas a Antonio para crear el proyecto de Vercel (root directory
   `apps/agent-api`) — **no hay herramienta disponible en esta sesión para
   crear un proyecto de Vercel enlazado a git ni para configurar sus
   variables de entorno**; ese paso de dashboard es exclusivamente manual.

**Pendiente, bloqueado en un paso humano**: crear el proyecto en Vercel y
pegar las env vars. En cuanto esté desplegado, correr `GET
/internal/role-check` con el token, confirmar `connectedAs.current_user =
"agent_api_role"` y `deniedTableCheck.ok = false` (permission denied) +
`allowedTableCheck.ok = true`, borrar la ruta y este pendiente pasa a
cerrado. Hasta entonces, F1 queda cerrada **técnicamente** (código,
pruebas, pipeline) pero no **operacionalmente** (nadie confirmó el
aislamiento en producción real).

## Fase F2 — Infraestructura transversal — ✅ CERRADA (2026-08-10)

**Alcance aprobado** (instrucción explícita de Antonio): únicamente la
infraestructura transversal — rate limiting atómico en Postgres, auditoría
según las garantías ya definidas en F1, idempotencia, `requestId`, y
concurrencia optimista real (CAS) de `Page.version`, incluyendo al panel
humano. **Explícitamente fuera de alcance**: endpoints de F3 y escritura
agentic de F4 — no se agregó ninguna ruta HTTP nueva en `apps/agent-api`
para que un agente escriba `Page.content`; el mecanismo quedó construido y
probado exhaustivamente para que F4 lo consuma sin tener que diseñarlo.

### Qué se construyó

- **CAS real de `Page.version`** (`PrismaPageRepository`): `createInitial`
  (falla si `(offerId, kind)` ya existe) y `updateWithVersion` /
  `updateWithVersionAudited` — `UPDATE ... WHERE "version" = $esperado
  RETURNING *` en una sola sentencia; 0 filas devueltas = `VersionConflictError`,
  nunca una escritura "a ciegas". `savePageContent` (use-case) decide crear
  vs. actualizar según si el llamador trae una `expectedVersion`.
- **Panel humano participa del mismo CAS**: las 4 forms de edición de Page
  en `apps/admin` (`LandingPageForm`, `LandingBlocksForm`,
  `CheckoutPageForm`, `ThankYouPageForm`) ahora mandan `page?.version` en
  cada guardado; `savePageAction` distingue `VersionConflictError` y
  devuelve `{conflict: true, error: "...recargá..."}` en vez de guardar
  encima de un cambio que no vio. `PageRepository.upsert()` (blind upsert)
  se eliminó del código — ya no existe ningún camino de escritura de
  `Page.content` sin CAS.
- **Rate limiting atómico** (`PrismaRateLimitBucketRepository` +
  `enforceRateLimit`): `INSERT..ON CONFLICT..DO UPDATE SET count = count +
  1 RETURNING count` sobre `ApiRateLimitBucket`, una sola sentencia — cada
  ventana fija tiene su propio `bucketKey` (incluye el inicio de ventana),
  así que nunca hace falta decidir si resetear un contador. Conectado de
  verdad a `GET /whoami` (30 req/60s por `apiKeyId`) — es el único endpoint
  real que existe hoy, F2 no inventó uno nuevo solo para probar esto.
- **Idempotencia** (`PrismaIdempotencyRecordRepository` +
  `withIdempotency`): reserva atómica vía el `UNIQUE(apiClientId,
  idempotencyKey)` de `IdempotencyRecord` — exactamente un llamador
  concurrente "gana" (ejecuta), el resto espera (poll corto, ≤1s) el
  resultado ya resuelto. Misma key + payload distinto (`requestHash`) se
  rechaza con `IdempotencyConflictError`, nunca se ejecuta. Un fallo
  inesperado dentro de `execute()` finaliza el registro igual (nunca queda
  trabado para siempre) y se relanza al llamador original.
- **`requestId` extremo a extremo**: `resolveRequestId()` respeta
  `X-Request-Id` si el llamador lo manda (para correlacionar con sus
  propios logs) o genera uno; se devuelve en todas las respuestas de
  `/whoami` (header `X-Request-Id`, éxito o denegado) y es el mismo valor
  que queda en `AgentAuditLog.requestId`.
- **`executeAgentPageUpdate`**: compone las 4 garantías anteriores
  (rate limit → idempotencia → CAS → auditoría atómica) en una sola
  función, lista para que F4 la llame desde un endpoint real. Un conflicto
  de versión se modela como `{status: 409, ...}` dentro de la ejecución
  idempotente (no como excepción) — así también queda cacheado si el mismo
  request se reintenta con la misma key.
- Nuevos errores de dominio: `VersionConflictError`, `RateLimitExceededError`,
  `IdempotencyConflictError`, `IdempotencyInProgressError`
  (`packages/core/src/domain/shared/domain-error.ts`).

### Hallazgo corregido durante la implementación

El `PageRepository.upsert()` original (F0 y anterior) escribía
`Page.content` a ciegas por `(offerId, kind)`, sin leer ni comparar
`version` — es decir, **el campo `version` que F0 agregó nunca se usaba
para nada** hasta esta fase. Cualquier guardado (admin o, en el futuro, un
agente) simplemente pisaba el `content` anterior completo. F2 lo
reemplaza: ya no existe ningún camino de escritura de `Page.content`, ni
humano ni agentic, que no pase por la CAS.

### Verificación — pruebas de concurrencia reales contra Postgres

Mismo entorno que F1 (Postgres 16 local, no producción; migraciones
aplicadas y base descartada al terminar). `packages/core/test/agent-access-concurrency.integration.test.ts`,
11/11 verde, cada uno disparando llamadas realmente concurrentes
(`Promise.all`/`Promise.allSettled`) — la garantía vive en las sentencias
atómicas de Postgres, no en ninguna serialización de JavaScript:

| Requisito pedido | Resultado verificado |
|---|---|
| Dos escrituras simultáneas, misma `version` | Exactamente 1 de 2 gana (y de 10, exactamente 1 de 10) — el resto recibe `VersionConflictError`; `version` final incrementó una sola vez |
| Admin vs. operación concurrente | `updateWithVersion` (admin) y `updateWithVersionAudited` (agente) compitiendo por la misma `version`: exactamente uno gana, nunca ambos, nunca ninguno; si ganó el agente existe su `AgentAuditLog`, si ganó el admin no existe ninguno — sin estado ambiguo |
| Rate limit bajo concurrencia | Límite 5, 20 llamadas concurrentes → exactamente 5 pasan (`count` 1..5 sin huecos ni repetidos) y 15 se rechazan; una ventana nueva no hereda el conteo de la anterior |
| Misma Idempotency-Key + mismo payload | 10 llamadas concurrentes → la mutación se ejecuta 1 sola vez; las 10 devuelven el mismo `{status, body}` |
| Misma key + payload distinto | `IdempotencyConflictError`, nunca se ejecuta |
| Mutación crítica + auditoría | Éxito → existen Page nueva Y su `AgentAuditLog` juntos; conflicto de versión → no existe ningún `AgentAuditLog` huérfano y la Page quedó intacta (mismo commit o mismo rollback, verificado, no solo asumido por usar `$transaction`) |
| Excepción inesperada en idempotencia | El registro se finaliza en 500 igual (nunca queda trabado) y el error real se relanza al llamador |
| `executeAgentPageUpdate` compuesto | Reintento con la misma key+payload devuelve el resultado cacheado sin volver a incrementar `version` |

Suite completa de `packages/core` (incluyendo F0/F1): **121/121 tests
verdes, 7 skipped (tests "live" contra sandboxes reales de Wompi/PayPal,
sin cambios), sin regresiones**. `pnpm run boundaries` (81 módulos, 204
dependencias, sin violaciones), `pnpm -r typecheck` y `pnpm -r lint` en
verde en los 7 workspaces, `pnpm -r build` en verde incluyendo
`apps/web`/`apps/admin`/`apps/agent-api` (el editor de Pages de
`apps/admin` compila y renderiza con el nuevo flujo de `expectedVersion`).

### Simplificaciones deliberadas (a revisar si F3/F4 las necesitan)

- `hashRequestPayload` usa `JSON.stringify` — no es un hash canónico
  general (dos objetos con el mismo contenido pero distinto orden de
  claves de inserción producirían hashes distintos). Suficiente hoy porque
  el llamador controla la forma exacta del payload; si F4 recibe JSON
  arbitrario de un agente, esto necesita normalizarse antes.
- `ApiRateLimitBucket` no tiene limpieza de filas vencidas —
  `agent_api_role` ni siquiera tiene `DELETE` sobre esa tabla (F0). No es
  un problema de corrección (cada ventana es una fila nueva, nunca se
  relee una vieja), pero la tabla crece sin límite; una tarea de limpieza
  periódica queda pendiente para cuando eso importe operacionalmente.
- `updateWithVersionAudited` registra `latencyMs: 0` — no mide la latencia
  real de la request HTTP que lo llama (no existe esa request todavía).
  F4 puede pasar la latencia real cuando exista un endpoint de verdad.

### Declaración de cierre

**F2 queda formalmente cerrada el 2026-08-10.** Las 4 garantías pedidas
(rate limiting, idempotencia, CAS de versión, auditoría atómica) están
implementadas, conectadas al único endpoint real que existe
(`GET /whoami`) donde aplica, retrofiteadas al panel humano donde aplica
(CAS), y verificadas con pruebas de concurrencia reales contra Postgres —
no solo unitarias con mocks. No se implementó ningún endpoint de
lectura de catálogo (F3) ni de escritura agentic (F4).
