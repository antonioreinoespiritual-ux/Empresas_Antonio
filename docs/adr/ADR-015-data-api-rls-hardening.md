# ADR-015: Data API de Supabase apagada, grants de anon/authenticated revocados, RLS diferido

- **Estado**: Aceptada y aplicada en producción
- **Fecha**: 2026-08-10
- **Decide**: Antonio (aprobación explícita), ejecutado por Claude
- **Evidencia completa**: [`docs/security/2026-08-10-data-api-rls-audit.md`](../security/2026-08-10-data-api-rls-audit.md)

## Contexto

Una auditoría de seguridad (originada por la pregunta de si el proyecto de
Supabase tenía RLS activado) encontró que:

1. El **Data API (PostgREST)** de Supabase estaba habilitado por defecto.
2. Supabase otorga por defecto `ALL` sobre cada tabla de `public` a los
   roles `anon` y `authenticated` — sin relación con si el proyecto usa
   PostgREST o no.
3. Ninguna app del monorepo (`apps/web`, `apps/admin`, `apps/agent-api`) usa
   el Data API: todo el acceso a Postgres pasa por Prisma (rol `postgres`,
   `BYPASSRLS`) o por `agent_api_role` (ver
   `prisma/agent-access-layer/create_agent_api_role.sql`, F0 del Agent
   Access Layer). `anon`/`authenticated` tienen `rolcanlogin=false`: solo
   pueden ser asumidos por PostgREST, nunca por una conexión directa.
4. Con el Data API habilitado y esos grants heredados, cualquier persona
   con la `anon key` pública (embebida en cualquier cliente que la usara)
   podía leer y escribir directamente `products`, `users`, `payments`, etc.
   vía HTTP, sin pasar por ninguna regla de negocio de Prisma. Prueba
   directa antes del fix: `200`/`201` en `/rest/v1/products`,
   `/rest/v1/users`, `/rest/v1/payments` con la `anon key`.
5. Una revisión completa de integridad (conteos de fila, timestamps
   `createdAt`/`updatedAt` de `payments`, cadena `customers → orders →
   payments → entitlements`, roles de Postgres, logs de API de las últimas
   24h) no encontró evidencia de explotación real de esta exposición.

## Decisión

1. **Apagar el Data API** del proyecto (Project Settings → Data API →
   "Enable Data API" = off). Es un ajuste de dashboard, no de SQL/API — no
   hay forma de aplicarlo por migración. **Este es el control primario.**
2. **Versionar y aplicar** `prisma/security/harden_public_grants.sql` como
   defensa en profundidad, independiente del paso 1:
   - `REVOKE ALL` sobre todas las tablas/sequences/functions existentes de
     `public` para `anon`/`authenticated`.
   - `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE
     ALL ... FROM anon, authenticated` — corrige el default de Supabase
     para que **toda tabla futura creada por una migración de Prisma nazca
     sin exposición**. Sin este paso, la siguiente `prisma migrate deploy`
     vuelve a exponer lo que cree, exactamente como pasó con las 6 tablas
     del Agent Access Layer al aplicarse antes de este fix.
   - `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`
     — Postgres otorga `EXECUTE` a la pseudo-rol `PUBLIC` (que incluye a
     `anon`/`authenticated` por membresía implícita) sobre toda función
     nueva, por comportamiento propio del motor, independiente de los
     GRANTs explícitos por rol.
   - `service_role` queda deliberadamente intacto: es la identidad de
     confianza de Supabase para uso server-side; no se usa hoy en este
     proyecto pero tocarla está fuera del alcance de este cambio.
3. **No activar RLS** en las tablas de `public` en este momento. Con el
   Data API apagado y los grants heredados revocados, no existe hoy ningún
   camino de acceso (PostgREST) que dependa de políticas RLS para ser
   seguro — activar RLS ahora no cerraría ninguna exposición real
   adicional. Ver "Cuándo revisar esta decisión" abajo.
4. **Revocar las sesiones administrativas activas** (28/28, expiradas —no
   borradas, para conservar el rastro) como remediación conservadora,
   dado que no se puede descartar con certeza absoluta un acceso anterior
   a la ventana de logs disponible (24h) desde la creación del proyecto.

## Consecuencias

- El acceso a Postgres queda limitado, en la práctica, a dos identidades:
  el rol `postgres` (Prisma, todas las apps) y `agent_api_role` (F0 del
  Agent Access Layer, permisos mínimos por tabla/verbo). Ninguna de las
  dos pasa por PostgREST ni depende de RLS.
- **Toda migración de Prisma futura sigue siendo segura por default**: una
  tabla nueva no nace expuesta a `anon`/`authenticated`, incluso si alguien
  reactivara el Data API sin saber de este ADR.
- Si en el futuro se activa el Data API para un caso de uso real (p. ej. un
  cliente Supabase directo desde el navegador), **este ADR queda invalidado
  en su punto 3** y hay que activar RLS explícitamente, tabla por tabla,
  antes de exponerla — no basta con revertir el hardening de grants.
- Este ADR y `harden_public_grants.sql` son la referencia a citar si una
  futura revisión de seguridad vuelve a preguntar "¿por qué RLS está
  apagado?" — la respuesta es este documento, no una nueva investigación
  desde cero.

## Cuándo revisar esta decisión

- Si se reactiva el Data API de Supabase por cualquier motivo.
- Si se agrega cualquier uso de `service_role` desde código de aplicación.
- Si se introduce un cliente Supabase (`@supabase/supabase-js` u otro) que
  hable con Postgres vía HTTP en lugar de vía Prisma/`agent_api_role`.
- Como mínimo, en cada revisión de seguridad periódica del proyecto.

## Referencias

- `prisma/security/harden_public_grants.sql` (commits `a11c655`, `d79cfb7`)
- `prisma/agent-access-layer/create_agent_api_role.sql` (F0, commit `96a9030`)
- `docs/security/2026-08-10-data-api-rls-audit.md` — informe completo de la
  auditoría, evidencia de verificación y revocación de sesiones.
- `docs/roadmap/agent-access-layer.md` — PLAN-AGENT-API-01, cierre formal
  de F0.
