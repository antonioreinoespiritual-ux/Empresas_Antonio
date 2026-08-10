import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Serverless (Vercel) + Postgres pooleado (Supabase, modo session, pool_size
// bajo por defecto): cada contenedor de función abre su propio PrismaClient,
// y sin esto Prisma le asigna su propio pool interno (varias conexiones por
// cliente) — con varios contenedores concurrentes eso agota el pool_size del
// lado del pooler (visto en producción real: "FATAL: max clients reached in
// session mode - pool_size: 15"). connection_limit=1 fuerza como máximo una
// conexión física por contenedor, sin importar cuántas queries concurrentes
// haga ese contenedor — es la recomendación oficial de Prisma para serverless
// contra un pooler tipo pgbouncer. pgbouncer=true además desactiva prepared
// statements, que el modo pooled de Supabase no soporta de forma confiable.
function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  const url = new URL(raw);
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
  if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
  return url.toString();
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: datasourceUrl() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
