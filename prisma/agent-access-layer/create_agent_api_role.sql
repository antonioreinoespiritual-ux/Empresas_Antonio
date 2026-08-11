-- Rol restringido de PostgreSQL para apps/agent-api (Agent Access Layer).
-- Aprobado por Antonio — ver ARCH-AGENT-API-01 §"Modelo de permisos SQL" y
-- PLAN-AGENT-API-01, F0. Least privilege por TABLA y por OPERACIÓN: nunca
-- ALL, nunca DELETE/UPDATE "por comodidad".
--
-- Este script NO se ejecuta automáticamente desde la aplicación ni desde
-- migraciones de Prisma. Se aplica una sola vez, manualmente, contra la base
-- de datos real (vía SQL editor de Supabase o `psql` con una identidad
-- administrativa), separado del ciclo normal de `prisma migrate`. La
-- identidad que ejecuta `prisma migrate` (DIRECT_URL) es distinta de
-- `agent_api_role` y conserva privilegios de owner/migración; agent_api_role
-- jamás debe poder crear/alterar tablas.
--
-- Reemplazar '<PASSWORD_SEGURA>' por un secreto generado (no reutilizar
-- ninguna otra credencial) antes de ejecutar. Guardar el secreto en el
-- gestor de variables de entorno de apps/agent-api (Vercel), nunca en git.

-- 1) Rol de aplicación, sin privilegios de superusuario/DDL global.
CREATE ROLE agent_api_role
  WITH LOGIN
  PASSWORD '<PASSWORD_SEGURA>'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION;

-- 2) Conexión a la base y uso del schema. USAGE no otorga acceso a datos por
--    sí solo — cada tabla requiere su propio GRANT explícito más abajo.
GRANT CONNECT ON DATABASE postgres TO agent_api_role;
GRANT USAGE ON SCHEMA public TO agent_api_role;

-- 3) GRANTs mínimos por tabla y por operación (aprobados explícitamente,
--    verbatim de la corrección final de Antonio sobre PLAN-AGENT-API-01).
--    Cualquier tabla nueva queda SIN acceso por defecto: no hay
--    ALTER DEFAULT PRIVILEGES. Dar acceso a una tabla futura es un cambio
--    explícito y revisado de este script, nunca automático.

-- Identidad de agentes: solo lectura. Alta/edición de ApiClient/ApiKey pasa
-- por casos de uso de application/ ejecutados con una identidad distinta
-- (panel admin humano), no por agent_api_role.
GRANT SELECT ON "api_clients" TO agent_api_role;
GRANT SELECT ON "api_keys" TO agent_api_role;

-- Catálogo: apps/agent-api solo lee producto/oferta/precio, nunca los crea
-- ni modifica desde este rol.
GRANT SELECT ON "products" TO agent_api_role;
GRANT SELECT ON "offers" TO agent_api_role;
GRANT SELECT ON "prices" TO agent_api_role;

-- Contenido de páginas: el único caso de uso real con escritura directa.
-- Sin DELETE — no existe todavía un caso de uso aprobado que elimine Pages;
-- si aparece, se agrega aquí justificado por ese caso de uso concreto, no
-- por comodidad.
GRANT SELECT, INSERT, UPDATE ON "pages" TO agent_api_role;

-- Auditoría: solo escritura de nuevas filas — nunca UPDATE/DELETE, un audit
-- log editable o borrable deja de ser confiable. El SELECT de acá abajo NO
-- es para que apps/agent-api pueda leer su propio historial (ninguna ruta
-- lo hace — el panel /agents de apps/admin lo lee con una identidad
-- distinta): es un requisito de Postgres para el propio INSERT. Prisma
-- (`.create()`) siempre hace `RETURNING` para devolver la fila creada, y
-- Postgres exige privilegio de SELECT sobre cualquier columna mencionada en
-- un RETURNING (de un INSERT/UPDATE/DELETE), sin importar el motivo —
-- hallado en producción real (F9): sin este SELECT, TODO INSERT vía Prisma
-- fallaba con "permission denied", enmascarado además por un bug propio en
-- with-idempotency.use-case.ts que ocultaba el error real.
GRANT SELECT, INSERT ON "agent_audit_logs" TO agent_api_role;

-- Rate limiting: requiere INSERT..ON CONFLICT..DO UPDATE atómico (ver
-- ADR-03), por eso necesita los tres verbos sobre esta tabla puntual.
GRANT SELECT, INSERT, UPDATE ON "api_rate_limit_buckets" TO agent_api_role;

-- Preview tokens: se emiten (INSERT), se validan en cada request (SELECT) y
-- se revocan marcando revokedAt (UPDATE) — nunca se borran físicamente para
-- conservar el rastro de qué token existió.
GRANT SELECT, INSERT, UPDATE ON "preview_tokens" TO agent_api_role;

-- Idempotencia: se reserva con un placeholder (INSERT), se consulta en
-- reintentos (SELECT), y se finaliza con el resultado real una vez que la
-- mutación protegida termina (UPDATE de esa misma fila — patrón
-- reserva→ejecuta→finaliza de with-idempotency.use-case.ts). Sin UPDATE,
-- toda escritura exitosa termina en 500 al no poder finalizar su propio
-- registro de idempotencia (hallado en producción real, F9).
GRANT SELECT, INSERT, UPDATE ON "idempotency_records" TO agent_api_role;

-- 4) Nada de esto usa secuencias/funciones/rutinas propias (los ids son
--    cuid() generados en la aplicación, no seriales de Postgres) ni Row
--    Level Security (el acceso es por protocolo Postgres directo con este
--    rol dedicado, no por la capa PostgREST de Supabase) — no se requieren
--    GRANTs adicionales de USAGE sobre sequences ni políticas RLS para que
--    este rol funcione.
