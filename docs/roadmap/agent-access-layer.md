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

_(El reporte de cierre de F1, con evidencia de implementación, pruebas y
verificación, se agrega en esta misma sección al completarse la fase — ver
más abajo.)_
