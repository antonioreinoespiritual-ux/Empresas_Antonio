-- Endurecimiento de acceso Data API/PostgREST sobre el schema public.
--
-- Contexto: una auditoría de seguridad (aprobada por Antonio) detectó que
-- Supabase otorga por defecto ALL (SELECT/INSERT/UPDATE/DELETE/...) sobre
-- cada tabla de public a los roles anon/authenticated/service_role, y que
-- esta plataforma (apps/web, apps/admin, apps/agent-api) NO usa el Data API
-- de Supabase para nada: todo el acceso a Postgres pasa por Prisma (rol
-- postgres, BYPASSRLS) o por agent_api_role (permisos mínimos ya definidos
-- en ../agent-access-layer/create_agent_api_role.sql). anon/authenticated
-- tienen rolcanlogin=false: solo pueden ser asumidos por PostgREST, nunca
-- por una conexión directa (psql, Prisma, agent_api_role).
--
-- Este script es un complemento, no un sustituto, de deshabilitar el Data
-- API del proyecto (Project Settings > Data API > "Enable Data API" = off
-- en el dashboard de Supabase — no existe forma de hacerlo por SQL/API).
-- El REVOKE de abajo es la defensa que sigue funcionando si el Data API
-- alguna vez se reactiva por error o a propósito para un caso de uso
-- futuro que hoy no existe.
--
-- Igual que create_agent_api_role.sql: se aplica una sola vez, manualmente,
-- contra la base real. No es una migración de Prisma — Prisma seguiría
-- generando esta misma exposición en cada tabla nueva si no se corrige el
-- default (paso 2), y este script no forma parte de `prisma migrate`.
--
-- Verificado en una branch aislada de Supabase antes de aplicarse a
-- producción: confirmado sin impacto en Prisma (rol postgres, BYPASSRLS),
-- Better Auth (mismo camino que Prisma), ni en agent_api_role (los mismos
-- GRANTs de create_agent_api_role.sql, verbo por verbo, siguen intactos).
-- Ver también: prueba HTTP directa con la anon key contra /rest/v1/ —
-- antes: 200/201 en products, users, payments; después: 401 en las tres.

-- Auditoría de pg_default_acl (2026-08-10) confirmó que hoy no existe
-- ninguna sequence ni function propia en public (Prisma usa cuid() de
-- aplicación, no serial de Postgres; no hay stored procedures). Es decir:
-- no hay ningún GRANT existente que revocar en esas dos categorías, pero
-- el default sí las expone -- la primera sequence/función que se cree
-- (por ejemplo, si una extensión de Supabase alguna vez instala algo en
-- public en vez de en su propio schema) nacería otra vez abierta si no se
-- corrige el default también ahí. Ninguna de las dos tiene caso de uso
-- real para anon/authenticated en este proyecto -- se revoca todo.

-- 1) Revocar los privilegios heredados sobre los objetos EXISTENTES.
--    ALL (no solo SELECT/INSERT/UPDATE/DELETE) para no dejar colgado
--    TRUNCATE/REFERENCES/TRIGGER, aunque PostgREST no los use directamente.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- 2) Corregir el default de Supabase para que los objetos FUTUROS
--    (creados por cualquier migración de Prisma, que corre como rol
--    postgres) NO nazcan otorgando acceso a anon/authenticated. Sin este
--    paso, la próxima `prisma migrate deploy` vuelve a exponer lo que
--    cree -- exactamente lo que pasó con las 6 tablas del Agent Access
--    Layer (F0) al aplicarse sin este fix.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- 3) Postgres otorga EXECUTE a la pseudo-rol PUBLIC (es decir, a *cualquier*
--    rol, incluidos anon/authenticated vía su membresía implícita en
--    PUBLIC) sobre toda función nueva, por comportamiento propio del
--    motor -- independiente de lo otorgado/revocado arriba por rol
--    explícito. Sin esta línea, una función futura creada por postgres en
--    public seguiría siendo ejecutable por anon/authenticated a través de
--    PUBLIC aunque el paso 2 ya les revocó el EXECUTE nominal.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Nota deliberada: service_role conserva sus GRANTs, tanto en objetos
-- existentes como en el default de objetos futuros. service_role es la
-- identidad de confianza que Supabase reserva para uso server-side (Edge
-- Functions, dashboard, integraciones futuras); hoy no se usa en este
-- proyecto, pero tocarla queda fuera del alcance decidido para este
-- cambio. Si se deshabilita el Data API del proyecto por completo (paso
-- manual, ver arriba), este matiz deja de tener cualquier efecto práctico
-- para los tres roles.
--
-- También deliberado: no se toca el default ACL de role supabase_admin
-- (Supabase también lo define aparte del de postgres). Nuestras
-- migraciones siempre corren como postgres; supabase_admin es interno de
-- la plataforma y no tenemos un caso de uso propio que justifique tocarlo.
