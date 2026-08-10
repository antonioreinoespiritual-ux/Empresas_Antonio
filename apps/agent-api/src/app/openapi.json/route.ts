import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/openapi";

// F7 (PLAN-AGENT-API-01): "se publica sin autenticación, ya que un schema
// no es un secreto — evita inventar una forma de verificar sesión de admin
// dentro de apps/agent-api, que deliberadamente no tiene Better Auth."
export async function GET(request: Request) {
  return NextResponse.json(buildOpenApiDocument(new URL(request.url).origin), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
