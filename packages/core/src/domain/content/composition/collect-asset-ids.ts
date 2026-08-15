import type { CompositionContent, ElementNode, InnerRowNode, RowNode, SectionNode } from "./node";

// Fase 5 (ARCH-LANDING-EDITOR-02 §7) — recorre el árbol completo y junta
// todos los assetId referenciados (image, video con source "asset" + su
// posterAssetId opcional, gallery), para que el caller (apps/web) resuelva
// todos en un solo roundtrip antes de renderizar. Pura, sin I/O — mismo
// criterio que tree-operations.ts.
function collectFromElement(node: ElementNode, ids: Set<string>): void {
  if (node.type === "image") {
    ids.add(node.content.assetId);
  } else if (node.type === "video" && node.content.source.kind === "asset") {
    ids.add(node.content.source.assetId);
    if (node.content.source.posterAssetId) ids.add(node.content.source.posterAssetId);
  } else if (node.type === "gallery") {
    for (const item of node.content.items) ids.add(item.assetId);
  }
}

function collectFromRow(node: RowNode | InnerRowNode, ids: Set<string>): void {
  for (const child of node.children) {
    if (child.type === "row") collectFromRow(child, ids);
    else collectFromElement(child, ids);
  }
}

function collectFromSection(node: SectionNode, ids: Set<string>): void {
  for (const row of node.children) collectFromRow(row, ids);
}

export function collectAssetIds(composition: CompositionContent): string[] {
  const ids = new Set<string>();
  for (const section of composition.root) collectFromSection(section, ids);
  return [...ids];
}
