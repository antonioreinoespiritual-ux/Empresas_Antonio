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

-- 1) Revocar los privilegios heredados sobre las tablas EXISTENTES.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- 2) Corregir el default de Supabase para que las tablas FUTURAS (creadas
--    por cualquier migración de Prisma, que corre como rol postgres) NO
--    nazcan otorgando acceso a anon/authenticated. Sin este paso, la
--    próxima `prisma migrate deploy` vuelve a exponer la tabla nueva —
--    exactamente lo que pasó con las 6 tablas del Agent Access Layer (F0)
--    al aplicarse sin este fix.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated;

-- Nota deliberada: service_role conserva sus GRANTs, tanto en tablas
-- existentes como en el default de tablas futuras. service_role es la
-- identidad de confianza que Supabase reserva para uso server-side (Edge
-- Functions, dashboard, integraciones futuras); hoy no se usa en este
-- proyecto, pero tocarla queda fuera del alcance decidido para este
-- cambio. Si se deshabilita el Data API del proyecto por completo (paso
-- manual, ver arriba), este matiz deja de tener cualquier efecto práctico
-- para los tres roles.
