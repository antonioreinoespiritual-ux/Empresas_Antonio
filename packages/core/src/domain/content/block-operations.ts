import { ConflictError, DomainError, NotFoundError } from "../shared/domain-error";
import { toLandingBlocks, type LandingBlock, type LandingPageContent } from "./page-content";

// Transformaciones puras sobre el contenido de una Page LANDING — F4
// (escritura agentic, bloques direccionables por id — PLAN-AGENT-API-01).
// Ninguna hace I/O: reciben el contenido actual (ya migrado a `{blocks}` vía
// toLandingBlocks si venía en el formato legacy — la migración ocurre acá,
// al persistir el resultado de la primera operación de bloque sobre una
// Page legacy, nunca de otra forma) y devuelven el contenido nuevo, listo
// para pasar por parsePageContent + la CAS de PageRepository. Nunca
// mutan el array recibido.

export function addBlockToContent(content: LandingPageContent, block: LandingBlock): LandingPageContent {
  const blocks = toLandingBlocks(content);
  if (blocks.some((b) => b.id === block.id)) {
    throw new ConflictError(`Ya existe un bloque con id "${block.id}"`);
  }
  return { blocks: [...blocks, block] };
}

/**
 * No permite cambiar `type` — mezclar campos de dos tipos de bloque
 * distintos vía patch produciría una forma inválida; cambiar de tipo es
 * removeBlock + addBlock, explícito, nunca implícito en un patch parcial.
 */
export function updateBlockInContent(
  content: LandingPageContent,
  blockId: string,
  patch: Record<string, unknown>
): LandingPageContent {
  const blocks = toLandingBlocks(content);
  const index = blocks.findIndex((b) => b.id === blockId);
  const existing = blocks[index];
  if (index === -1 || existing === undefined) throw new NotFoundError(`No existe el bloque "${blockId}"`);
  if (patch.type !== undefined && patch.type !== existing.type) {
    throw new DomainError(`No se puede cambiar el type de un bloque ("${existing.type}" -> "${patch.type}") — remove + add`);
  }
  const next = [...blocks];
  next[index] = { ...existing, ...patch, id: blockId, type: existing.type } as LandingBlock;
  return { blocks: next };
}

export function removeBlockFromContent(content: LandingPageContent, blockId: string): LandingPageContent {
  const blocks = toLandingBlocks(content);
  const next = blocks.filter((b) => b.id !== blockId);
  if (next.length === blocks.length) throw new NotFoundError(`No existe el bloque "${blockId}"`);
  return { blocks: next };
}

/** `orderedBlockIds` debe incluir cada id existente exactamente una vez — nunca agrega/quita bloques, solo reordena. */
export function reorderBlocksInContent(content: LandingPageContent, orderedBlockIds: string[]): LandingPageContent {
  const blocks = toLandingBlocks(content);
  if (orderedBlockIds.length !== blocks.length || new Set(orderedBlockIds).size !== blocks.length) {
    throw new DomainError("El nuevo orden debe incluir cada id de bloque existente exactamente una vez, sin repetidos");
  }
  const byId = new Map(blocks.map((b) => [b.id, b] as const));
  const next = orderedBlockIds.map((id) => {
    const block = byId.get(id);
    if (!block) throw new NotFoundError(`No existe el bloque "${id}"`);
    return block;
  });
  return { blocks: next };
}
