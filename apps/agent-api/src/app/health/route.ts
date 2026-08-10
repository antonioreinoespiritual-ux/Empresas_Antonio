import { NextResponse } from "next/server";

// Única ruta de F0: confirma que el esqueleto de apps/agent-api despliega y
// responde, sin tocar todavía Prisma ni ningún caso de uso de
// application/agent-access (eso es F1+). No requiere autenticación —no
// expone ningún dato— para poder usarse como health check de la
// plataforma de despliegue.
export async function GET() {
  return NextResponse.json({ status: "ok", service: "agent-api" }, { headers: { "Cache-Control": "no-store" } });
}
