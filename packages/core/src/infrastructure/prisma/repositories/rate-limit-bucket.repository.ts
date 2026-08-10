import type { ConsumeRateLimitInput, RateLimitRepository } from "../../../application/agent-access/ports/rate-limit-repository.port";
import { prisma } from "../client";

export class PrismaRateLimitBucketRepository implements RateLimitRepository {
  async consume(input: ConsumeRateLimitInput): Promise<{ count: number }> {
    // Una sola sentencia atómica: bajo N llamadas concurrentes con el mismo
    // (apiKeyId, bucketKey), Postgres serializa los UPDATE sobre esa fila
    // (row lock) — cada llamada recibe un count distinto y consecutivo,
    // nunca un valor repetido ni saltado.
    const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
      `INSERT INTO "api_rate_limit_buckets" ("apiKeyId","bucketKey","windowStart","count")
       VALUES ($1,$2,$3,1)
       ON CONFLICT ("apiKeyId","bucketKey") DO UPDATE SET "count" = "api_rate_limit_buckets"."count" + 1
       RETURNING "count"`,
      input.apiKeyId,
      input.bucketKey,
      input.windowStart
    );
    const [row] = rows;
    if (!row) throw new Error("INSERT..ON CONFLICT..DO UPDATE de api_rate_limit_buckets no devolvió ninguna fila");
    return { count: row.count };
  }
}
