// Asigna un id estable a cada bloque de content.blocks[] en las Page LANDING
// existentes que todavía no lo tienen — requisito previo a que el dominio
// exija `id` en LandingBlock (ADR-04, packages/core/src/domain/content/
// page-content.ts). Sin este backfill, cualquier Page guardada antes de ese
// cambio dejaría de poder leerse (parsePageContent la rechazaría).
//
// Idempotente: una Page cuyos bloques ya tienen id no se modifica (no genera
// una nueva escritura ni un id distinto en cada corrida). Páginas en formato
// legacy (sin `content.blocks`) se ignoran — no usan LandingBlock.
//
// Por defecto corre en modo simulación (dry-run): imprime qué Page y cuántos
// bloques cambiaría, sin escribir nada. Requiere --apply explícito para
// escribir — no se asume "aditivo = seguro" (ver PLAN-AGENT-API-01, F0,
// gate de migración a producción). Antes de --apply en producción, correr
// primero contra una copia representativa de la base de datos.
//
// Uso:
//   node --env-file=.env packages/core/scripts/backfill-landing-block-ids.mjs           (dry-run)
//   node --env-file=.env packages/core/scripts/backfill-landing-block-ids.mjs --apply    (escribe)
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

function hasBlocksShape(content) {
  return !!content && typeof content === "object" && Array.isArray(content.blocks);
}

function backfillBlocks(blocks) {
  let changed = 0;
  const next = blocks.map((block) => {
    if (block && typeof block === "object" && typeof block.id === "string" && block.id.length > 0) {
      return block;
    }
    changed += 1;
    return { ...block, id: randomUUID() };
  });
  return { next, changed };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  try {
    const pages = await prisma.page.findMany({ where: { kind: "LANDING" } });
    let pagesToChange = 0;
    let blocksToChange = 0;

    for (const page of pages) {
      if (!hasBlocksShape(page.content)) continue;
      const { next, changed } = backfillBlocks(page.content.blocks);
      if (changed === 0) continue;

      pagesToChange += 1;
      blocksToChange += changed;
      console.log(`Page ${page.id} (offerId=${page.offerId}): ${changed} bloque(s) sin id.`);

      if (apply) {
        await prisma.page.update({
          where: { id: page.id },
          data: { content: { ...page.content, blocks: next } },
        });
      }
    }

    console.log(
      `${apply ? "Aplicado" : "Simulación (dry-run)"}: ${pagesToChange} Page(s), ${blocksToChange} bloque(s) en total.`
    );
    if (!apply && pagesToChange > 0) {
      console.log("Nada se escribió. Volvé a correr con --apply para persistir los cambios.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
