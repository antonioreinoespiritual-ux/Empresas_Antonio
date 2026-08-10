import { NextResponse } from "next/server";
import { prisma } from "@repo/core/infrastructure";

// Ruta de diagnóstico TEMPORAL para el cierre operativo de F1 — confirma
// desde el runtime real de Vercel qué rol de Postgres está usando esta app
// (nunca debe ser `postgres`) y que los GRANTs de agent_api_role
// (prisma/agent-access-layer/create_agent_api_role.sql) se cumplen de
// verdad: lectura permitida en una tabla con GRANT, denegada en una tabla
// sin GRANT. No devuelve filas de datos, solo current_user/session_user
// (no son secretos) y si cada SELECT tuvo éxito o el mensaje de error de
// Postgres (que tampoco contiene credenciales).
//
// Debe eliminarse (o al menos deshabilitarse) apenas se complete la
// verificación — ver docs/roadmap/agent-access-layer.md, cierre operativo
// de F1. Deshabilitada por defecto: sin AGENT_API_ROLE_CHECK_TOKEN
// configurado, responde 404 sin tocar la base.
export async function GET(request: Request) {
  const expectedToken = process.env.AGENT_API_ROLE_CHECK_TOKEN;
  if (!expectedToken || request.headers.get("x-role-check-token") !== expectedToken) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [identity] = await prisma.$queryRawUnsafe<{ current_user: string; session_user: string }[]>(
    `SELECT current_user, session_user`
  );

  async function checkTable(table: string) {
    try {
      await prisma.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
      return { table, ok: true };
    } catch (error) {
      return { table, ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  const [allowed, denied] = await Promise.all([checkTable("products"), checkTable("admin_users")]);

  return NextResponse.json(
    { connectedAs: identity, allowedTableCheck: allowed, deniedTableCheck: denied },
    { headers: { "Cache-Control": "no-store" } }
  );
}
