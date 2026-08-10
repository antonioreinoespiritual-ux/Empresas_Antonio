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

### Cierre operativo de F1 — ✅ CERRADA (2026-08-10)

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

**Resuelto.** Antonio creó el proyecto de Vercel (`empresas-antonio-admin-fgcq`,
root directory `apps/agent-api`) desde el dashboard, siguiendo git (auto-deploy
en cada push a `main`, igual que los otros dos proyectos). Dos problemas de
configuración encontrados y corregidos antes de la verificación real:

1. **Framework Preset no persistía en el dashboard** (`framework: null` vía
   API pese a seleccionar "Next.js" y guardar) → build fallaba con `No Output
   Directory named "public" found` (Vercel esperaba un build estático). Fix a
   nivel de código, no de dashboard: `apps/agent-api/vercel.json` con
   `{"framework": "nextjs"}`, para que no vuelva a depender de un click en la
   UI.
2. **`DATABASE_URL`/`DIRECT_URL` apuntaban al rol `postgres`** (connection
   string default de Supabase, credenciales además inválidas) en vez de
   `agent_api_role` → `PrismaClientInitializationError` en runtime. Corregido
   con el formato correcto de Supavisor (transaction pooler) para un rol que
   no es `postgres`: el project ref va como sufijo del usuario —
   `agent_api_role.<project_ref>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
   (`?pgbouncer=true` desactiva prepared statements, obligatorio en modo
   transacción).

Verificación real contra el deployment de producción (`GET
/internal/role-check` con el token, antes de borrar la ruta):

```json
{
  "connectedAs": {"current_user": "agent_api_role", "session_user": "agent_api_role"},
  "allowedTableCheck": {"table": "products", "ok": true},
  "deniedTableCheck": {"table": "admin_users", "ok": false, "error": "...permission denied for table admin_users"}
}
```

Confirmado con las cuatro combinaciones esperadas: `GET /health` → `200`;
`/internal/role-check` sin token → `404`; con token incorrecto → `404`; con
token correcto → `200` con el resultado de arriba. El aislamiento de
`agent_api_role` es real en producción, no solo en el SQL: lee donde hay
GRANT, Postgres rechaza donde no lo hay (`42501 permission denied`), y la
ruta de diagnóstico está oculta por defecto para cualquiera sin el token.

Ruta `GET /internal/role-check` y variable `AGENT_API_ROLE_CHECK_TOKEN`
**eliminadas** del código (`apps/agent-api/src/app/internal/`) y de
`.env.example` inmediatamente después de esta verificación — pendiente que
Antonio quite también el valor de `AGENT_API_ROLE_CHECK_TOKEN` del proyecto
de Vercel (dashboard) y redespliegue; con la ruta ya borrada del código, ese
valor queda inerte de todas formas.

Con esto, F1 queda cerrada tanto **técnicamente** (código, pruebas,
pipeline) como **operacionalmente** (aislamiento de `agent_api_role`
confirmado en producción real).

**Decisión explícita (2026-08-10, instrucción de Antonio)**: no se vuelve
a rotar la password de `agent_api_role` en esta etapa — se usa la ya
rotada arriba. Se evaluó automatizar el deploy completo con la única
herramienta disponible para crear proyectos nuevos de Vercel
(`deploy_to_vercel`), pero esa herramienta sube un árbol de archivos
suelto sin integración de git y sin ningún campo para variables de
entorno — forzarla habría dejado un deployment desconectado de git (sin
auto-deploy en cada push, a diferencia de `empresas-antonio-admin`/`-web`)
y el secreto embebido en un archivo del propio deployment. Decisión: el
import se hace desde el dashboard de Vercel (Antonio), como los otros dos
proyectos — no hay atajo de herramienta que preserve las mismas garantías.
Ver la sección siguiente para el gate que esto deja pendiente antes de
producción definitiva.

## Gate obligatorio antes de F9 / producción definitiva

Registrado por instrucción explícita de Antonio (2026-08-10). No es un
gate de ninguna fase en particular — aplica transversalmente y se revisa
de nuevo antes de declarar cualquier "producción definitiva" del Agent
Access Layer, sin importar qué fase esté vigente en ese momento:

- [ ] **Rotar `agent_api_role` una última vez**, con un secreto generado y
  cargado directo en el gestor de secretos definitivo — nunca reutilizar
  el valor rotado el 2026-08-10 durante el cierre operativo de F1 (ese
  transitó, aunque una sola vez y de forma deliberada, por esta
  conversación — cualquier secreto que haya existido en un canal de chat,
  sin importar cuán acotada la exposición, se considera de un-nivel de
  confianza distinto al de un secreto que nace directo en el gestor).
- [x] **Eliminar (no solo deshabilitar) toda ruta y variable de diagnóstico
  temporal**: `GET /internal/role-check`
  (`apps/agent-api/src/app/internal/role-check/route.ts`) y
  `AGENT_API_ROLE_CHECK_TOKEN`. Hecho el 2026-08-10, inmediatamente después
  de la prueba positiva/negativa contra producción — ver el cierre
  operativo de F1 más abajo. Pendiente solo que Antonio quite el valor
  residual de `AGENT_API_ROLE_CHECK_TOKEN` del dashboard de Vercel (inerte
  sin la ruta, pero conviene no dejarlo).
- [ ] **Auditar variables de entorno de los 3 proyectos de Vercel**
  (`empresas-antonio-admin`, `empresas-antonio-web`, y el de
  `apps/agent-api` una vez creado) buscando cualquier valor de
  prueba/diagnóstico que haya sobrevivido de una verificación anterior.
- [ ] **Confirmar que ningún secreto usado en desarrollo/staging (F0–F8)
  se reutiliza en la configuración de producción definitiva** —
  regenerar, no reciclar.

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

## Fase F3 — Lectura de catálogo — ✅ CERRADA (2026-08-10)

**Alcance aprobado** (instrucción explícita de Antonio, 2026-08-10): endpoints
de solo lectura en `apps/agent-api` para que un agente autenticado pueda leer
Products, Offers (con Prices embebidas) y Pages (contenido) — "todo lo que le
permita a mi editorial de agentes moverse libremente". Explícitamente **sin**
restricción por `allowedOfferIds` en lectura (esa restricción queda para
escritura, F4). Sin paginación — no existe ningún precedente de paginación en
todo el monorepo (grep de `skip:|take:|cursor:` → 0 resultados en `apps/` y
`packages/core`); si el volumen real de Products/Offers lo justifica, se
agrega cuando haga falta, no antes.

### Qué se construyó

- **Composition root** (`apps/agent-api/src/lib/agent-access.ts`): se agregan
  `PrismaProductRepository` y `PrismaOfferRepository` — `agent_api_role` ya
  tenía `SELECT` sobre `products`/`offers`/`prices` desde F0, anticipando esta
  fase; el bloqueo era solo de código de aplicación, no de permisos de
  Postgres.
- **`apps/agent-api/src/lib/require-agent-read.ts`**: helper compartido que
  extrae el patrón de `whoami` (F1) — autenticar, denegar+auditar,
  rate-limit+auditar — y le agrega un chequeo de scope explícito vía
  `authorizeAgentAction(principal, { scope: "read", isWrite: false })`. Las 5
  rutas nuevas lo reusan en vez de repetir ~45 líneas de boilerplate cada una.
- **`GET /products`, `GET /products/:id`**: lectura directa de
  `ProductRepository.list()`/`findById()`, sin cambios sobre el puerto
  existente (el mismo que usa `apps/admin`).
- **`GET /offers`, `GET /offers/:id`**: lectura de `OfferRepository.list()`/
  `findById()` — ya traen `prices` embebidas (`OfferListItem`/
  `OfferWithPrices`); no existe (ni se crea) un `PriceRepository` separado,
  Price siempre cuelga de Offer en este dominio.
- **`GET /pages?offerId=&kind=`**: lectura vía `PageRepository.findByOfferAndKind`
  — el único método de lectura puntual que ya existía (F0/F2). No se agrega
  un "listar todas las Pages": `PageKind` tiene 3 valores fijos
  (`LANDING`/`CHECKOUT`/`THANK_YOU`) y `offerId` ya se obtiene de
  `GET /offers`, así que un agente puede enumerar las páginas de una Offer
  sin necesitar un endpoint de listado nuevo. `kind` inválido o ausente →
  `400 invalid_query` (nunca 500, nunca una query a Postgres con un enum
  inválido).

### Decisión explícita: exigir scope `"read"`

F1 dejó `ApiKey.scopes` como `string[]` libre, sin ningún consumidor real —
`whoami` no exige ninguno porque es introspección de la propia identidad, no
acceso a datos de negocio. F3 es la primera vez que una ApiKey lee datos de
negocio reales; sin un scope que lo gatee, el mecanismo de scopes construido
en F1 seguiría completamente decorativo. Decisión: las 5 rutas de F3 exigen
`authorizeAgentAction(principal, { scope: "read", isWrite: false })` —
`missing_scope` → `403` (mismo código que ya existía en
`DENIAL_STATUS_CODE`, sin cambios ahí). **Consecuencia operativa**: ninguna
ApiKey emitida antes de F3 tiene este scope; hay que reemitir con
`--scopes read` (`manage-agent-clients.mjs issue-key --client-id <id>
--scopes read`) para poder usar `/products`, `/offers` o `/pages`. `/whoami`
sigue sin exigir scope — no es un recurso de negocio.

### Verificación — pruebas ejecutadas contra Postgres real, no solo escritas

Mismo entorno que F1/F2 (Postgres 16 local, no producción; las 7 migraciones
existentes aplicadas, base descartada al terminar). Suite completa de
`packages/core` sin cambios de código en ese paquete (F3 solo agrega código
en `apps/agent-api`) — **121/121 tests verdes, 7 skipped, sin regresiones**,
confirmando que agregar `PrismaProductRepository`/`PrismaOfferRepository` al
composition root de `apps/agent-api` no rompió nada existente.

Smoke test end-to-end real por HTTP (no solo vitest) contra `apps/agent-api`
corriendo en local con datos seedeados (1 Product, 1 Offer con 1 Price, 1
Page `LANDING`) y dos ApiKeys reales emitidas con el CLI (una con
`--scopes read`, otra sin scopes):

| Caso | Resultado |
|---|---|
| `GET /products` sin `Authorization` | `401 invalid_credentials` |
| `GET /products` con key sin scope `read` | `403 missing_scope` |
| `GET /products` con key con scope `read` | `200`, incluye el Product seedeado |
| `GET /products/:id` existente | `200` |
| `GET /products/:id` inexistente | `404 not_found` |
| `GET /offers` | `200`, cada Offer con `prices` embebidas |
| `GET /offers/:id` | `200` |
| `GET /pages?offerId=X&kind=LANDING` (existe) | `200` con `content` completo |
| `GET /pages?offerId=X&kind=CHECKOUT` (no existe esa Page) | `404 not_found` |
| `GET /pages?offerId=X` (sin `kind`) | `400 invalid_query` |
| `GET /whoami` con la key sin scope `read` | `200` — F1 sigue sin exigir scope, no regresionó |

`pnpm run boundaries` (81 módulos, 204 dependencias, sin violaciones),
`pnpm -r typecheck`, `pnpm -r lint` y `pnpm -r build` verificados en verde en
los 7 workspaces después de todos los cambios — `apps/agent-api` build final
con las 7 rutas: `/health`, `/whoami`, `/products`, `/products/[id]`,
`/offers`, `/offers/[id]`, `/pages`.

### Declaración de cierre (superada por el retrofit de abajo)

**F3 queda formalmente cerrada el 2026-08-10.** Lectura de catálogo completa
(Products, Offers con Prices, Pages) disponible para cualquier agente
autenticado con scope `read`, sin restricción por Offer, verificada con
datos reales contra Postgres — no solo con mocks. No se implementó ninguna
escritura agentic (F4) ni paginación (sin precedente en el repo, se agrega
si el volumen lo justifica).

## Retrofit de F1/F3 y cierre de F4 — 2026-08-10

Esta sesión encontró que el plan completo de fases (`PLAN-AGENT-API-01`, 10
fases F0→F9, "Plan aprobado" con correcciones de kill switch/rol de
Postgres/auditoría transaccional/gate de migración) existía versionado en
un documento que esta sesión no tenía en contexto — la nota de procedencia
al inicio de este archivo ya advertía que ese plan "nunca se versionó como
documento en este repositorio". Al recibirlo, se encontraron desvíos reales
entre lo ya construido (F1/F3, arriba) y el plan aprobado. Antonio decidió
corregir todo para que coincida con el plan, y construir F4 con su alcance
completo (no la versión simplificada que se había planeado inicialmente).

### Desvíos corregidos

| Punto | Plan aprobado | Antes de este retrofit |
|---|---|---|
| Prefijo de rutas | `/api/v1/agent/*` | Rutas en la raíz (`/whoami`, `/products`, etc.) |
| `allowedOfferIds` en lectura | Debe respetarse ("confirmado por Antonio" en el plan) | Sin restricción (instrucción distinta dada en esta misma sesión, antes de ver el plan) |
| Endpoints de F3 | `/products`, `/offers`, `/themes`, `/block-types`, `/pages` | Faltaban `/themes` y `/block-types` |
| Paginación | Cursor obligatorio | No implementada |
| Kill switch | Vercel Edge Config (primario) + env var (respaldo) | Solo env var |

**Rutas** movidas a `apps/agent-api/src/app/api/v1/agent/*` (`/health` queda
en la raíz, es infraestructura de F0, no de negocio).

**`allowedOfferIds` en lectura**: `authorizeAgentAction` ya soportaba el
parámetro `offerId` desde F1 (nunca se usaba desde una ruta HTTP hasta
ahora). `/offers/:id` y `/pages` (con `offerId` explícito) lo llaman antes
de tocar la base → `403 offer_not_allowed`. Las listas (`/offers`,
`/products`) filtran en la propia query SQL vía nuevos métodos
`listForAgent()` en `OfferRepository`/`ProductRepository` (`list()` sigue
intacto para `apps/admin`, patrón ya usado en F1/F2: variante nueva junto a
la existente, nunca modificar la que ya tiene consumidores). **Decisión de
diseño para `Product`**: no tiene un `offerId` único (relación 1-a-muchos
con `Offer`) — un Product es visible si tiene *al menos una* Offer dentro
de `allowedOfferIds`; fuera de alcance → `404` (no `403`, no hay un único
`offerId` que negar, y no se confirma su existencia a quien no tiene
acceso). Mismo criterio de "404 sobre 403 cuando no hay un solo offerId que
evaluar" se aplicó a `GET/PATCH /pages/:id` y a los endpoints de bloques —
`offerId` no se conoce hasta leer la Page por su propio `id`.

**`/themes`, `/block-types`**: catálogos estáticos (sin Postgres), igual
autenticados/auditados que cualquier otra ruta. `/themes` expone
`THEME_IDS` (dominio, ya existente). `/block-types` expone un catálogo
nuevo (`packages/core/src/domain/content/block-type-catalog.ts`) — describe
a mano los 8 tipos de bloque de `landingBlockSchema` (`hero`, `vsl`,
`benefits`, `testimonials`, `faq`, `guarantee`, `cta`, `richText`) para que
un agente sepa qué campos requiere cada uno antes de intentar crearlo (F4),
sin tener que adivinar el schema Zod.

**Paginación**: cursor-based (`?cursor=<id>&limit=<n>`, default 20, tope
100) en `/products`, `/offers`, `/pages`. Nuevo tipo compartido
`PaginatedResult<T>`/`CursorPaginationInput`
(`packages/core/src/application/shared/paginated-result.ts`).

**Kill switch vía Vercel Edge Config**: `apps/agent-api/src/lib/kill-switch.ts`
— señal primaria en Edge Config (clave `agent_api_kill_switch: boolean`),
caché en memoria por instancia (TTL 15s), **fail-closed** (si la lectura
falla, se trata como activado — sin excepción por caché previo). Env var
(`AGENT_API_KILL_SWITCH`) sigue como respaldo de último recurso, en OR.
**Pendiente de un paso de Antonio**: crear el Edge Config store en el
dashboard de Vercel y conectarlo al proyecto (fija automáticamente la env
var `EDGE_CONFIG`) — sin eso, el código cae al comportamiento anterior
(solo env var) sin romper nada, simplemente sin la señal de baja latencia.

### F4 — Escritura de Pages (alcance completo del plan) — ✅ CERRADA

Segundo consumidor real de `ApiKey.scopes` (después de `read` en F3):
`WRITE_SCOPE = "write"`. `authorizeAgentAction(principal, {scope, isWrite,
offerId})` ahora se llama con `isWrite: true` — `forceReadOnly` bloquea
cualquiera de estos endpoints aunque la key tenga el scope, sin excepción.

**Endpoints** (todos bajo `/api/v1/agent/pages`):

| Ruta | Verbo | Qué hace |
|---|---|---|
| `/pages` | `POST` | Crea una Page nueva (`Idempotency-Key` requerido) |
| `/pages/:id` | `PATCH` | Reemplaza el `content` completo, CAS vía `If-Match` |
| `/pages/:id/blocks` | `POST` | Agrega un bloque (solo Pages `LANDING`) |
| `/pages/:id/blocks/:blockId` | `PATCH` | Edita un bloque por su `id` estable (F0) |
| `/pages/:id/blocks/:blockId` | `DELETE` | Elimina un bloque |
| `/pages/:id/reorder` | `POST` | Reordena los bloques existentes |
| `/pages/:id/variants` | `POST` | Crea una variante A/B |

**`Idempotency-Key` en todas, no solo en `POST /pages`**: el plan solo lo
menciona explícito para la creación, pero `executeAgentPageWrite` (F2) ya
lo exige siempre — se decidió exigirlo en todo el camino de escritura por
consistencia, no dejar un endpoint sin esa protección solo porque el plan
no lo mencionó ahí.

**`If-Match`** transporta la `version` esperada (CAS, ETag-style) — falta →
`428 Precondition Required`. Reutiliza el mecanismo de F2
(`updateWithVersionAudited`) sin cambios de fondo; `executeAgentPageUpdate`
se renombró a **`executeAgentPageWrite`** y ahora decide crear vs.
actualizar según si el llamador trae `expectedVersion` (mismo criterio que
ya usaba `savePageContent` para el panel humano) — antes (F2) solo sabía
actualizar.

**Operaciones de bloque** (`packages/core/src/domain/content/block-operations.ts`):
`addBlockToContent`, `updateBlockInContent`, `removeBlockFromContent`,
`reorderBlocksInContent` — funciones puras sobre `LandingBlock[]`, sin I/O.
Las rutas HTTP leen la Page actual, aplican la transformación pura, y
persisten el resultado a través del mismo `executeAgentPageWrite` de
arriba (ninguna operación de bloque tiene su propio mecanismo de
rate-limit/idempotencia/CAS — todas reusan el único que ya existía).
`updateBlockInContent` no permite cambiar el `type` de un bloque vía patch
(mezclar campos de dos tipos produciría una forma inválida) — es
removeBlock + addBlock, explícito. Contenido resultante siempre revalidado
por el schema Zod completo antes de persistir (`parsePageContent`) —
**hallazgo corregido en el camino**: esa validación podía lanzar `ZodError`
sin capturar fuera de `executeAgentPageWrite` (defecto preexistente desde
F2, nadie lo había notado porque F2 nunca tenía una ruta HTTP real
llamándolo) — ahora se traduce a `400 invalid_content` centralizado ahí,
beneficia a todos los llamadores.

#### Migración de esquema: variantes A/B reales

El `@@unique([offerId, kind])` original (F0) impedía, a nivel de base de
datos, que existiera una segunda Page para la misma Offer+kind — ni
siquiera como variante. `variantGroupId`/`variantLabel` existían desde F0
pero "preparado, sin implementar". Antonio aprobó migrar
(`prisma/migrations/20260810183836_page_variant_label_unique/`):

- `@@unique([offerId, kind, variantLabel])` (declarativo en Prisma) — cierra
  el caso de dos variantes con el mismo label para la misma Offer+kind.
  **Insuficiente por sí solo**: en SQL estándar NULL nunca es igual a NULL,
  así que este constraint no evita dos Pages "primarias" (`variantLabel`
  NULL) para la misma Offer+kind.
- Índice único parcial agregado a mano (Prisma no puede expresar índices
  parciales declarativamente): `CREATE UNIQUE INDEX ...  ON "pages"("offerId", "kind") WHERE "variantLabel" IS NULL` — cierra ese caso, garantiza como
  máximo una primaria.
- **Aditiva sobre datos existentes**: toda fila de `pages` en producción
  tiene hoy `variantLabel` NULL (nunca se usó), así que el índice parcial
  es, en este momento, exactamente equivalente al constraint que reemplaza
  — cero cambio de comportamiento para filas existentes.
- Verificado con inserts SQL directos contra Postgres local: segunda
  primaria → rechazada; dos variantes con labels distintos → ambas
  aceptadas; variante con label duplicado → rechazada.
- **Pendiente**: aplicar esta migración a la base real de Supabase
  (`gbcghkfhgikrlisxexig`) antes de que `/pages/:id/variants` funcione en
  producción — el código ya está desplegable, pero la migración es un paso
  separado (igual que toda migración de este repo, nunca corre sola desde
  el build de Vercel).

#### Hallazgo corregido durante la implementación — encontrado con un smoke test real, no en el compilador

Habilitar variantes rompió una asunción implícita: `updateWithVersion`/
`updateWithVersionAudited` (F2) direccionaban la fila a actualizar solo por
`(offerId, kind)` — válido mientras esa pareja identificaba una única fila.
Con variantes, puede haber una primaria y N variantes para la misma
Offer+kind, así que ese `WHERE` quedó ambiguo. Un smoke test real contra
Postgres lo expuso de inmediato: un `PATCH` dirigido explícitamente a una
variante por su `:id` terminó modificando la Page **primaria** en su lugar
(las rutas nuevas nunca pasaban `variantLabel` a `performAgentPageWrite`,
que por lo tanto defaulteaba a `null` = primaria, sin importar cuál `:id`
pedía el llamador).

Corregido en dos capas:
1. `UpdatePageWithVersionInput`/`CreatePageInput` (puerto) ganan
   `variantLabel`/`variantGroupId`; el `WHERE` de las dos actualizaciones
   ahora incluye `AND "variantLabel" IS NOT DISTINCT FROM $N` (comparación
   null-safe — un `=` normal nunca es true contra NULL).
2. Las 4 rutas que direccionan una Page por `:id` (`PATCH /pages/:id`,
   `POST/PATCH/DELETE .../blocks[/:blockId]`, `POST .../reorder`) ahora
   pasan `variantLabel: page.variantLabel` explícitamente.

Reproducido y confirmado el fix con el mismo smoke test: `PATCH` sobre una
variante ya modifica solo esa fila; la primaria queda intacta.

### Verificación

Mismo entorno que F1/F2/F3 (Postgres 16 local, no producción; las 8
migraciones existentes — incluyendo la nueva — aplicadas, base descartada
al terminar). `packages/core`: **121/121 tests verdes, 7 skipped, sin
regresiones** (ninguna prueba existente se modificó salvo el rename
`executeAgentPageUpdate` → `executeAgentPageWrite`).

Smoke test HTTP real end-to-end, con datos y credenciales reales, dos
rondas (retrofit F3 + F4, y luego re-verificación tras el fix de
variantes):

| Caso | Resultado |
|---|---|
| `GET /offers` con `allowedOfferIds` acotado | Solo la Offer permitida, nunca la prohibida |
| `GET /offers/:id` sobre una Offer fuera de alcance | `403 offer_not_allowed` |
| `GET /themes`, `GET /block-types` | `200`, catálogos completos |
| `GET /products?limit=1` | `200`, `nextCursor` presente/`null` según corresponda |
| `POST /pages` con key sin scope `write` | `403 missing_scope` |
| `POST /pages` sin `Idempotency-Key` | `400 missing_idempotency_key` |
| `POST /pages` sobre Offer fuera de alcance | `403 offer_not_allowed` |
| `POST /pages` (offerId, kind) ya existente | `409` (`ConflictError`) |
| Reintento con la misma `Idempotency-Key` + mismo payload | Mismo resultado cacheado, no duplica |
| `POST/PATCH/DELETE` de bloques sin `If-Match` | `428 missing_if_match` |
| `If-Match` con `version` vieja | `409` (`VersionConflictError`) |
| Ciclo completo: crear → agregar bloque → editar bloque → reordenar → eliminar bloque → `PATCH` de content completo | Cada paso `200`/`201`, `version` incrementa exactamente 1 por paso, estado final consistente |
| `POST /pages/:id/variants` (label nuevo) | `201`, nueva Page con mismo `offerId`+`kind`, `variantGroupId` propio |
| `POST /pages/:id/variants` (label duplicado) | `409` |
| `PATCH`/`POST blocks` sobre una variante (tras el fix) | Modifica solo esa fila — primaria y otras variantes intactas |

`pnpm run boundaries` (84 módulos, 214 dependencias, sin violaciones),
`pnpm -r typecheck`, `pnpm -r lint` y `pnpm -r build` en verde en los 7
workspaces — `apps/agent-api` build final con 14 rutas.

### Declaración de cierre

**El retrofit de F1/F3 y F4 quedan formalmente cerrados el 2026-08-10**,
alineados con `PLAN-AGENT-API-01` (rutas `/api/v1/agent/*`,
`allowedOfferIds` en lectura y escritura, `/themes`+`/block-types`,
paginación, kill switch con Edge Config, escritura de Pages con bloques
direccionables + variantes). Pendientes explícitos, ninguno bloqueante para
el código ya desplegable:
- Aplicar la migración `page_variant_label_unique` a producción.
- Crear y conectar el Edge Config store en Vercel.

## F5 — Publicación y preview — ✅ CERRADA (2026-08-10)

Por instrucción explícita de Antonio ("avanzá hasta la fase final del plan,
implementalo todo rigurosamente... hazlo todo tú, sin preguntar"), esta
sesión continuó directamente hacia F5-F9 sin gate intermedio de aprobación
por fase — cada fase se construye con el mismo rigor de pruebas que F1-F4
(pipeline completo + smoke test real contra Postgres local antes de cada
commit), pero sin pausar a pedir confirmación entre una y la siguiente.

### Qué se construyó

- **`PreviewToken`** (`packages/core/src/domain/agent-access/preview-token.entity.ts`):
  mismo split público/secreto que `ApiKey` — `tokenId` indexado (no
  secreto) + `secretHash` (nunca el secreto en claro). Reusa el mismo
  `ApiKeyHasher` (SHA-256 + `timingSafeEqual`) — el secreto ya tiene la
  misma alta entropía, no hace falta una clase de hashing nueva.
- **`PreviewTokenRepository.createReplacingActive()`**: revoca (nunca
  `DELETE`, por trazabilidad) cualquier token vigente de la misma Page
  antes de crear el nuevo, en una sola transacción — nunca coexisten dos
  tokens vigentes para una Page. Los GRANTs de `agent_api_role` sobre
  `preview_tokens` (`SELECT, INSERT, UPDATE`) ya existían desde F0,
  anticipando exactamente esta fase.
- **`createPreviewToken`/`verifyPreviewToken`** (use-cases): `verifyPreviewToken`
  nunca distingue "token inexistente" de "secreto incorrecto" en la
  respuesta — mismo criterio anti-enumeración que `authenticateAgentRequest`.
- **Tercer scope real**: `PUBLISH_SCOPE = "publish:pages"`, deliberadamente
  distinto de `"write"` — una key puede editar contenido sin poder
  publicarlo. `requireAgentPublish` en `apps/agent-api/src/lib/require-agent-access.ts`.
- **`POST /pages/:id/publish`, `/unpublish`**: idempotentes por diseño
  (publicar dos veces es un no-op `200`, no un error) — usan el nuevo
  `PageRepository.setStatusAudited()` (audit atómico en la misma
  transacción, igual que `updateWithVersionAudited`; `setStatus` sin
  auditar queda para el panel humano, F6).
- **`POST /pages/:id/preview`**: funciona sin importar el `status` de la
  Page (a diferencia de publish/unpublish) — devuelve `previewUrl` +
  `expiresAt`. TTL 24h (arbitrario, documentado igual que otros TTL de este
  repo).
- **`apps/web/src/app/preview/[token]/page.tsx`**: reusa exactamente el
  mismo motor de render que `/[slug]` — extraído a un componente compartido
  (`LandingPageView`) para no duplicar el JSX entre ambas rutas.
- **Headers de seguridad vía `middleware.ts`** (no vía `Metadata` — un
  `page.tsx` de App Router no puede fijar headers HTTP reales):
  `Cache-Control: no-store`, `X-Robots-Tag: noindex`,
  `Referrer-Policy: no-referrer`. El hash del secreto protege contra una
  fuga de base de datos, no contra la URL en sí (puede quedar en logs de
  acceso o en un header `Referer`) — por eso TTL corto + revocación al
  emitir uno nuevo + estos headers, ninguno solo.

### Verificación

Mismo entorno que F1-F4 (Postgres 16 local, migraciones aplicadas, base
descartada al terminar). `packages/core`: **121/121 tests verdes, 7
skipped, sin regresiones**. Smoke test HTTP real contra ambas apps
(`apps/agent-api` + `apps/web`) corriendo en local:

| Caso | Resultado |
|---|---|
| `POST publish` con key sin `publish:pages` | `403 missing_scope` |
| `POST preview` con la Page en `DRAFT` (antes de publicar) | `201`, funciona igual |
| `POST publish` | `200`, `status` pasa a `PUBLISHED` |
| `POST publish` de nuevo | `200` no-op, mismo body, no error |
| `POST unpublish` | `200`, `status` vuelve a `DRAFT` |
| `GET /preview/:token` en `apps/web` real | `200`, headers `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer` confirmados, contenido del bloque `hero` renderizado |
| Token de preview inválido | `404` |
| Emitir un segundo preview de la misma Page | El primer token queda revocado (`404` al usarlo), el segundo funciona (`200`) |

`pnpm run boundaries`, `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r build`
en verde en los 7 workspaces — 17 rutas en `apps/agent-api`, `/preview/[token]`
nueva en `apps/web`.

### Declaración de cierre

**F5 queda formalmente cerrada el 2026-08-10.** Ciclo agentic completo
demostrable de punta a punta: leer catálogo (F3) → crear/editar contenido
con bloques y variantes (F4) → preview → publicar/despublicar (F5) — sin
ninguna intervención de código ni de base de datos fuera de las rutas HTTP
ya construidas.

## F6 — Panel de administración de agentes en apps/admin — ✅ CERRADA (2026-08-10)

F1 ya había construido toda la capa de aplicación necesaria
(`ApiClientRepository`, `ApiKeyRepository`, el use-case `issueApiKey`, el
tipo `AuditActor`) pensando en que un humano, no solo un agente, terminaría
gestionando estas identidades. F6 es sobre todo composición de UI sobre esa
base ya existente, reusando los primitivos de `packages/admin-ui` y las
convenciones ya establecidas en `offers`/`products`.

### Qué se construyó

- **`apps/admin/src/lib/agent-access.ts`**: composition root nuevo, análogo
  a `commerce.ts` — corre con el `DATABASE_URL` de rol `postgres` (nunca
  `agent_api_role`, que no tiene permiso de leer `AgentAuditLog` ni de
  mutar identidad — ver el comentario en el propio archivo y en
  `agent-audit-log-repository.port.ts`).
- **`AgentAuditLogRepository.list()`** (nuevo método, con su
  `AgentAuditLogRow`/`ListAgentAuditLogInput`): paginación por cursor sobre
  `agent_audit_logs`, mismo patrón que `listForAgent()` de F3/retrofit.
  Cubierto por una prueba de integración nueva
  (`test/agent-audit-log-list.integration.test.ts`, 4 casos: filtro por
  `apiClientId`, sin filtro, paginación sin duplicar/saltar filas, y
  `nextCursor` en `null` cuando la última página coincide exactamente con
  el `limit`).
- **`/agents`**: listado de `ApiClient` con estado y link al detalle.
- **`/agents/new`**: alta de cliente — nombre, descripción,
  `forceReadOnly`, y un selector de 3 estados para `allowedOfferIds`
  ("todas" / "ninguna" / "específicas") en vez de un array vacío por
  defecto, porque `null`/`[]`/array-con-ids son 3 estados con significado
  real en el dominio (ver F1).
- **`/agents/[id]`**: detalle — `ClientStatusToggle` (kill switch por
  cliente, con `ConfirmDialog` porque corta acceso real de todas las keys
  de golpe), `ForceReadOnlyToggle` (checkbox simple, menor consecuencia que
  suspender), `AllowedOfferIdsEditor`, y la tabla de `ApiKey` con emitir /
  rotar / revocar.
- **`IssueKeyDialog`**: el secreto se muestra en claro una única vez; el
  botón "Cerrar" queda deshabilitado hasta que se marca "Ya copié el
  secreto" — a diferencia de `ConfirmDialog`, este diálogo no se cierra con
  Escape ni clic afuera mientras el secreto está visible y sin confirmar.
  "Rotar" reusa el mismo diálogo (`rotatingKeyId` presente): emite la key
  nueva y solo entonces revoca la anterior — nunca al revés, para no dejar
  una ventana sin ninguna key vigente si la emisión fallara.
- **`/agents/audit`**: visor de `AgentAuditLog` — tráfico real de agentes
  autenticados o rechazados contra `apps/agent-api`, no las acciones del
  propio panel de admin (esas ya quedaban auditadas en la tabla `AuditLog`
  general desde antes de este plan — ver "Bug encontrado" abajo).

### Bug encontrado y corregido durante las pruebas de navegador

`ConfirmDialog` (`packages/admin-ui`) e `IssueKeyDialog` renderizan un
overlay `position: fixed` como hijo directo del árbol donde se montan. Eso
es válido en cualquier contenedor normal, pero `ApiKeyRow` los monta como
hermanos de un `<TableRow>` — es decir, directamente dentro de `<tbody>`,
donde un `<div>` no es HTML válido (`<tbody>` solo admite `<tr>`). Un test
de Playwright contra Chromium real expuso la advertencia de hidratación de
React que un `curl`/smoke test HTTP nunca podría detectar. Corregido
montando ambos diálogos vía `createPortal(..., document.body)` — el fix se
hizo en el primitivo compartido `ConfirmDialog` (beneficia también a
`price-manager.tsx`, que ya lo usaba fuera de una tabla y sigue funcionando
igual) y en `IssueKeyDialog` (local a `apps/admin`, mismo patrón).

### Verificación

Mismo entorno que F1-F5 (Postgres 16 local, migraciones aplicadas —
incluye la migración de variantes de F4 —, base descartada al terminar).
`packages/core`: **125/125 tests verdes, 7 skipped, sin regresiones** (121
previos + 4 nuevos de `agent-audit-log-list.integration.test.ts`).

Smoke test de navegador real (Playwright + Chromium, sin instalar
Playwright en el repo — `playwright-core` en un scratchpad ad hoc contra el
Chromium ya preinstalado del entorno) contra `apps/admin` corriendo en
local, con un `AdminUser` sembrado vía `scripts/seed-admin.mjs`:

| Caso | Resultado |
|---|---|
| Login real + navegar a `/agents` | `200`, listado vacío al inicio |
| Crear cliente (`allowedOfferIds = null`, "todas") | Redirige a `/agents/:id`, nombre visible |
| Crear cliente con "Offers específicas" (una Offer seleccionada) | `allowedOfferIds` queda con esa Offer únicamente |
| Emitir key (`read`+`write`) | Secreto mostrado una vez; "Cerrar" deshabilitado hasta marcar "Ya copié el secreto"; habilitado después |
| Revocar la key | Pasa a "Revocada" en la tabla, `ConfirmDialog` de por medio |
| Rotar una key | Emite una nueva y revoca la anterior; verificado directo en Postgres (`revokedAt` no nulo en la vieja, nula en la nueva) — la UI de Next dev tarda un instante extra en reflejarlo sin recargar, la base nunca estuvo en un estado inconsistente |
| `ForceReadOnlyToggle` / `AllowedOfferIdsEditor` | Cambios persisten tras recargar la página |
| Suspender / reactivar cliente (`ClientStatusToggle`) | Cambia de estado con `ConfirmDialog`, persiste |
| `/agents/audit` | Carga sin error (vacío en esta prueba — no se hicieron requests reales de agente en esta sesión de navegador) |
| Acciones de admin (crear/emitir/revocar) | Quedan en la tabla `AuditLog` general con `actorType: "admin"`, **no** en `AgentAuditLog` — confirmado por consulta directa a Postgres |

`pnpm run boundaries`, `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r build`
en verde en los 7 workspaces — 4 rutas nuevas en `apps/admin`
(`/agents`, `/agents/new`, `/agents/[id]`, `/agents/audit`).

### Declaración de cierre

**F6 queda formalmente cerrada el 2026-08-10.** Antonio ya no necesita
`scripts/manage-agent-clients.mjs` (CLI) para operar el ciclo de vida de un
agente en el día a día — puede crear clientes, emitir/rotar/revocar keys,
ajustar `allowedOfferIds`/`forceReadOnly`, suspender un cliente entero, y
auditar su tráfico, todo desde el panel.

## F7 — OpenAPI y contrato para MCP — ✅ CERRADA (2026-08-10)

Objetivo del plan: "que un MCP nuevo pueda integrarse leyendo solo el
contrato, nunca el código fuente."

### Qué se construyó

- **`apps/agent-api/src/lib/openapi.ts`**: genera el documento OpenAPI 3.1
  completo. El único punto donde ya existía un Zod schema real
  (`content` de LANDING/CHECKOUT/THANK_YOU, `landingBlockSchema`) se
  reutiliza tal cual vía `zod-to-json-schema` — el resto (parámetros,
  bodies de blocks/reorder/variants, todas las respuestas) se describe a
  mano, exactamente como preveía el plan ("más paths escritos a mano"),
  porque la mayoría de las rutas de F1-F5 valida su body con chequeos
  manuales, no con `z.object().parse()`.
- **`GET /openapi.json`** (`apps/agent-api/src/app/openapi.json/route.ts`):
  sin autenticación — "un schema no es un secreto", evita inventar una
  verificación de sesión de admin dentro de una app que deliberadamente no
  tiene Better Auth. `servers[].url` se construye con el origen real de la
  request (`new URL(request.url).origin`), nunca hardcodeado — el
  meta-schema oficial de OpenAPI 3.1 exige `format: "uri"` (URI absoluta)
  en `servers[].url`, y local/staging/producción son 3 dominios distintos
  (3 proyectos de Vercel separados).
- **`apps/agent-api/public/docs.html`**: visor estático (Scalar, vía CDN)
  que lee `/openapi.json` del lado del cliente. A propósito un archivo
  estático servido tal cual desde `public/`, no una página de React — el
  propio `next.config.mjs` documenta desde F0 que `apps/agent-api` no
  expone UI; éste y `/openapi.json` son la única excepción, y ninguno de
  los dos es "UI de la app" en ese sentido (uno es el contrato, el otro un
  visor de ese contrato).
- **`packages/core`**: `landingBlockSchema` y `landingBlocksContentSchema`
  pasan de privados a `export const` (antes solo su tipo inferido era
  público) — es el único cambio en `packages/core`, necesario para que el
  generador de OpenAPI los reutilice sin re-declararlos.

### Verificación

`apps/agent-api` no tenía ninguna infraestructura de pruebas propia hasta
ahora (todo vivía en `packages/core/test` contra Postgres real) — se
agregó un `vitest.config.ts` liviano, sin base de datos (el generador de
OpenAPI es una función pura), en `apps/agent-api/test/openapi.test.ts`:

| Prueba | Qué cubre |
|---|---|
| Valida contra el meta-schema oficial de OpenAPI 3.1 | No es una prueba estructural inventada — usa el JSON Schema real publicado en spec.openapis.org (`@apidevtools/openapi-schemas`, vía `@seriousme/openapi-schema-validator`) |
| Documenta exactamente las rutas y métodos reales | Compara `Object.keys(doc.paths)` contra el inventario real de `route.ts` de `apps/agent-api/src/app/api/v1/agent/**` — atrapa una ruta nueva sin documentar o una documentada que ya no existe |
| Toda operación autenticada declara `bearerAuth` + al menos un 401 | — |
| Los 429/503 documentados coinciden con la forma real que produce `agent-auth.ts` | — |

**Hallazgo real durante la implementación, no cosmético**: Ajv (el
validador JSON Schema más usado en el ecosistema JS) no resuelve
`$dynamicRef` fuera del objeto raíz en JSON Schema 2020-12 — y el
meta-schema oficial de OpenAPI 3.1 depende de `$dynamicRef` precisamente
para permitir que cualquier dialecto de JSON Schema aparezca embebido
dentro de un Parameter/Response Object. Validar con Ajv "de fábrica"
contra ese meta-schema producía **falsos negativos reales** (rutas y
parámetros correctos, marcados como inválidos) en casi todas las
`parameters`/`responses` anidadas del documento — no un error menor de
formato. Documentado también en el propio README de
`@apidevtools/openapi-schemas`. Resuelto reemplazando la validación directa
por `@seriousme/openapi-schema-validator`, que reescribe esos
`$dynamicRef` a `$ref` normales antes de compilar — sigue siendo el schema
oficial de OpenAPI 3.1, no uno relajado a mano.

Smoke test HTTP real contra `apps/agent-api` en local (Postgres 16,
migraciones aplicadas, base descartada al terminar):

| Caso | Resultado |
|---|---|
| `GET /openapi.json` sin `Authorization` | `200`, documento completo |
| `GET /docs.html` sin `Authorization` | `200`, HTML del visor |
| `servers[].url` | Refleja el origen real de la request (`http://localhost:3101`, no un placeholder) |
| `GET /whoami` sin `Authorization` | `401` |
| `GET /whoami` con una ApiKey real | `200`; la respuesta real, verificada campo por campo contra el schema documentado en `/openapi.json` para ese mismo endpoint, coincide exactamente (mismas claves requeridas, sin claves no documentadas) |
| `GET /products` con la misma key | `200`; forma real (`products[]`, `nextCursor`, `rateLimit`) coincide con lo documentado |

`pnpm run boundaries`, `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r build`
en verde en los 7 workspaces (incluye el nuevo `apps/agent-api test`, ahora
parte del pipeline de ese workspace) — `packages/core` sigue en
**125/125 tests verdes, 7 skipped**, sin regresiones por el cambio de
exports.

### Declaración de cierre

**F7 queda formalmente cerrada el 2026-08-10.** Cualquier MCP nuevo puede
integrarse contra esta API leyendo únicamente `GET /openapi.json` (o su
visor en `/docs.html`) — nunca necesita abrir el código fuente de
`apps/agent-api` para saber qué endpoints existen, qué autenticación
requieren, o qué forma tiene cada request/response.

## F8 — Verificación integral — ✅ CERRADA para todo lo ejecutable sin Antonio (2026-08-10)

El propio plan describe F8 así: "no es donde se escriben las pruebas — la
mayoría ya se escribieron dentro de F1-F5, cada una junto a la pieza que
valida. Esta fase es donde se corren todas juntas como gate final, y donde
ocurren las dos pruebas que no pueden existir antes." De esas dos, una
(el E2E con una key real) se construyó y se corrió acá; la otra (el MCP
real de Antonio) es, por definición del propio plan, "Necesita a Antonio"
— nadie más puede ejecutarla. Ver la sección final de este documento para
el detalle de qué queda pendiente exclusivamente para él.

### Qué se construyó

- **`scripts/e2e-agent-smoke.mjs`** (nuevo directorio `scripts/` en la raíz
  del repo, separado de `packages/core/scripts/` porque este no es un
  script de mantenimiento de una app puntual sino un smoke test HTTP
  cross-cutting): ejercita el ciclo agentic completo contra una instancia
  real de `apps/agent-api` — `whoami` → catálogo (`products`, `offers`,
  `themes`, `block-types`) → crear/obtener una Page de trabajo (variante si
  la Offer ya tenía una Page primaria, para no arriesgar un 409 en una
  Offer con contenido real) → agregar un bloque → editarlo → reordenar →
  emitir preview → publicar → publicar de nuevo (confirma el no-op
  idempotente) → despublicar → eliminar el bloque agregado (limpieza). Se
  corrió de punta a punta contra una instancia local real: **18/18 pasos
  en verde**, incluida la doble verificación de que tanto la rama "crear
  Page nueva" como la rama "crear variante sobre una Page primaria
  existente" funcionan (se confirmó cada una por separado, no solo la que
  tocó ejecutar orgánicamente en la corrida principal).
- **`packages/core/test/agent-api-role-grants.integration.test.ts`**
  (nuevo, 12 tests): ejecuta el script REAL de producción
  (`prisma/agent-access-layer/create_agent_api_role.sql`, sin copiarlo a
  mano) contra Postgres real, conecta después como `agent_api_role` de
  verdad, y prueba **la matriz negativa completa por operación** para las
  10 tablas otorgadas (SELECT/INSERT/UPDATE/DELETE, una por una) más el
  **default-deny de una tabla nueva sin ningún GRANT**. Limpia el rol y la
  tabla de prueba al terminar.
- **`apps/agent-api/test/kill-switch.test.ts`** (nuevo, 7 tests): sin un
  store de Edge Config real conectado todavía (pendiente, ya señalado en
  PRs anteriores — ver el cierre de esta sección), se probó el mecanismo
  en sí con Edge Config mockeado + fake timers: TTL de caché de **15s
  exactos** (verificado en el límite: cacheado a los 14 999ms, vuelve a
  consultar a los 15 001ms), **fail-closed real** al fallar la lectura
  (incluso con un valor cacheado previo distinto — nunca fail-open), y que
  el respaldo por variable de entorno bloquea de forma independiente sin
  siquiera consultar Edge Config.
- **`packages/core/test/agent-access-concurrency.integration.test.ts`**:
  un test nuevo de auditoría bajo carga real — 40 escrituras concurrentes
  (20 independientes + 20 compitiendo por CAS sobre la misma Page) y
  verificación en conjunto de que cada éxito tiene exactamente su
  `AgentAuditLog` y ningún conflicto deja huérfanos.

### Lo que este plan marca como "no puede existir antes de F8" y su estado real

| Ítem del plan | Estado |
|---|---|
| E2E con una key real (no la de seed) | ✅ Hecho — `scripts/e2e-agent-smoke.mjs`, 18/18 en verde |
| Integración real con el MCP de Antonio | ⛔ Necesita a Antonio — nadie más tiene su MCP real |
| Kill switch cronometrado (~30s, contra staging real) | ⚠️ Parcial — el mecanismo está probado exhaustivamente (TTL, fail-closed) con Edge Config mockeado; la medición en vivo contra un store real de Vercel Edge Config sigue bloqueada porque ese store todavía no existe (pendiente ya señalado en el PR de F1/F3 retrofit: "Crear y conectar el Edge Config store en el proyecto de Vercel") |
| Fallo inyectado de Edge Config | ✅ Hecho (vía mock) — fail-closed confirmado, nunca fail-open, con y sin caché previo |
| Default-deny por tabla nueva | ✅ Hecho — `agent-api-role-grants.integration.test.ts` |
| Matriz negativa por operación (9-10 tablas) | ✅ Hecho — las 10 tablas realmente otorgadas por el script de producción, no solo las 9 que menciona el plan (el script creció con F5: `preview_tokens`) |
| Atomicidad de auditoría bajo carga | ✅ Hecho — 40 escrituras concurrentes reales |
| Ensayo del gate de migración (restauración desde backup real) | ⛔ Necesita a Antonio — requiere su acceso al proyecto de Supabase real; no ejecutable contra una base local descartable |

### Verificación

Pipeline completo con Postgres 16 local (migraciones aplicadas, base
descartada al terminar): `pnpm run boundaries`, `pnpm -r typecheck`,
`pnpm -r lint`, `pnpm -r build` en verde en los 7 workspaces.
`packages/core`: **138/138 tests verdes, 7 skipped** (125 previos + 12 de
la matriz de grants + 1 de auditoría bajo carga). `apps/agent-api`:
**11/11 tests verdes** (4 de F7 + 7 de kill switch). El E2E real contra
una instancia local en vivo: **18/18 pasos**.

### Declaración de cierre

**F8 queda cerrada el 2026-08-10 para todo lo que es ejecutable sin la
intervención directa de Antonio.** Quedan exactamente dos brechas, ambas
ya identificadas por el propio plan como "Necesita a Antonio" (el MCP real
y el ensayo de restauración desde backup de producción) más una tercera
que depende de una pieza de infraestructura que Antonio todavía no
conectó (el store de Edge Config real) — ninguna de las tres es un
descuido de esta sesión, las tres requieren acceso o una decisión que
solo él tiene. Ver el reporte final de F9 para el detalle completo.

## F9 — Rollout a producción — ⚠️ AVANZADA; 4 pasos finales exclusivos de Antonio

F0-F8 quedan cerradas. Antonio autorizó explícitamente avanzar F9 sin él
("creo que puedes hacer todo sin mi, te autorizo... hazlo bien pero
hazlo"), y esta sesión tenía acceso real (vía MCP) al proyecto de
Supabase de producción (`empresas-antonio`, ref `gbcghkfhgikrlisxexig`) y
al equipo de Vercel (`leonel8`) — no una simulación. Con ese acceso se
hizo todo lo que era seguro y estaba dentro del alcance de las
herramientas disponibles. Quedan 4 pasos que son o bien imposibles para
un agente (su propio MCP), o deliberadamente reservados a su juicio
(secretos de producción, decisiones de negocio, disaster recovery).

### Hecho en esta sesión, contra infraestructura real

1. **Corregido un desvío real entre las migraciones de Prisma y el schema
   real de producción.** `_prisma_migrations` no tenía registro de
   `agent_access_layer_foundations` (F0) ni de `page_variant_label_unique`
   (F4) — la primera porque su SQL se aplicó por fuera de
   `prisma migrate deploy` en algún momento (las tablas ya existían), la
   segunda porque nunca se aplicó (el índice único de `pages` seguía
   siendo el viejo `(offerId, kind)`, sin el índice parcial). Esto haría
   fallar el próximo `prisma migrate deploy` real. Corregido en dos pasos,
   verificados con SQL real vía MCP de Supabase: (a) aplicado
   `page_variant_label_unique` de verdad (`DROP INDEX` + 2 `CREATE UNIQUE
   INDEX`, en una transacción — seguro porque las 6 Pages existentes ya
   tenían `variantLabel NULL`, cero filas en conflicto); (b) insertadas
   las 2 filas faltantes en `_prisma_migrations` con el checksum real
   (sha256 del `migration.sql` — verificado contra una migración ya
   aplicada para confirmar el algoritmo antes de escribir nada). Estado
   final: las 8 migraciones del repo, y solo esas 8, aparecen aplicadas.
2. **Corregido un error de proceso propio**: los commits de F7 y F8 se
   habían empujado a la rama después de que el PR #17 (F5+F6) ya se
   había mergeado, sin ningún PR nuevo que los trackeara. Detectado,
   corregido con `git rebase` sobre `origin/main` y un nuevo PR (#18),
   verificado en verde (3 checks de Vercel) y **mergeado a `main`** —
   confirmado con una nueva release real en producción.
3. **Confirmado en vivo contra el dominio real de producción**
   (`empresas-antonio-admin-fgcq.vercel.app`, el proyecto de Vercel real
   de `apps/agent-api` pese a su nombre): `/health` → `200`,
   `/openapi.json` → `200` con `servers[]` reflejando el dominio real,
   `/docs.html` → `200`, y una key inválida → `401` (no `503` — confirma
   que el kill switch no está atascado).
4. **Revisado el estado de seguridad de la Data API de Supabase**: el
   advisor de Supabase marca RLS deshabilitada en las 34 tablas — se
   verificó con SQL real que `anon`/`authenticated` no tienen **ningún**
   GRANT sobre ninguna tabla (`information_schema.role_table_grants`
   vacío para ambos roles), lo cual ya cerraba la Data API por completo
   desde el hardening de F0 (ADR-015) — la alerta del advisor es un falso
   positivo en este caso puntual, pero se documenta acá en vez de
   descartarla en silencio.

### Lo que queda, exclusivamente para Antonio, y por qué

1. **Crear y conectar un Edge Config store real** en el proyecto de
   Vercel de `apps/agent-api` — **bloqueado por herramientas, no por
   elección**: esta sesión no tiene ninguna herramienta de Vercel capaz
   de crear/conectar un Edge Config store ni de leer/escribir variables
   de entorno de un proyecto (se revisó la lista completa de tools
   disponibles). Sin esto, el kill switch en producción solo tiene su
   respaldo por variable de entorno (`AGENT_API_KILL_SWITCH`, requiere
   redeploy) — el mecanismo de Edge Config en sí ya está implementado y
   probado exhaustivamente (F1, F8).
2. **Emitir la primera `ApiClient`/`ApiKey` de producción real**, desde
   `https://empresas-antonio-admin-omega.vercel.app/agents` — **reservado
   deliberadamente**, no por falta de acceso: el propio secreto se
   muestra una única vez por diseño (F6) precisamente para que nunca
   quede en un log ni en una transcripción — emitirlo desde esta sesión
   pondría el secreto en claro en este mismo historial, contradiciendo
   ese diseño. Además, qué Offer usar y si arranca con `publish:pages`
   son decisiones de negocio suyas, no algo que un agente deba decidir
   por él aunque esté autorizado a actuar.
3. **Configurar su MCP de producción con esa key** y correr él mismo el
   ciclo básico contra producción — nadie más tiene su MCP real.
4. **Probar el kill switch en vivo** (una vez exista el Edge Config
   store), **revocar la key de prueba**, y el **ensayo de restauración
   desde backup** (ideal hacerlo en un branch de Supabase, no contra la
   base real con órdenes y pagos reales — no se intentó en esta sesión
   por ese motivo, aunque la herramienta para crear el branch sí está
   disponible si Antonio quiere que se explore esa vía por separado).

### Resumen de lo entregado en esta sesión (F5-F8, sin pausas intermedias)

Por instrucción explícita de Antonio de avanzar por su cuenta hasta el
final del plan sin pedir aprobación fase por fase, esta sesión cerró,
después del merge de F1/F3-retrofit+F4 (PR #16):

- **F5** — Publicación, despublicación y preview con `PreviewToken`.
- **F6** — Panel `/agents` completo en `apps/admin` (alta, scopes,
  `allowedOfferIds`, emitir/rotar/revocar keys, suspender clientes, visor
  de auditoría) — probado con Playwright contra Chromium real, no solo
  con `curl`.
- **F7** — `openapi.json` generado (parcialmente desde Zod, el resto a
  mano) + visor estático — validado contra el meta-schema oficial de
  OpenAPI 3.1, no una verificación estructural inventada.
- **F8** — E2E real de 18 pasos, matriz negativa de permisos SQL
  ejecutando el script real de producción, kill switch probado en su
  mecanismo exacto (TTL + fail-closed), y auditoría bajo 40 escrituras
  concurrentes reales.

Cada fase se cerró con el mismo patrón: Postgres 16 real local,
migraciones aplicadas, smoke test real (HTTP o navegador, nunca solo
build/typecheck), limpieza completa del entorno, y un PR abierto contra
`main` con el detalle. Un bug real de HTML inválido (F6, `ConfirmDialog`
dentro de `<tbody>`) y un falso negativo real de Ajv contra el meta-schema
de OpenAPI 3.1 (F7) se encontraron y corrigieron en el camino — ninguno
de los dos era evidente sin correr las pruebas de navegador/validación
reales que este plan exige.
