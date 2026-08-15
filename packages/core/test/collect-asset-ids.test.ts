import { describe, expect, it } from "vitest";
import { collectAssetIds, type CompositionContent } from "../src/domain";

function composition(children: unknown[]): CompositionContent {
  return {
    version: "composition-1",
    root: [{ type: "section", id: "sec-1", children: [{ type: "row", id: "row-1", children }] }],
  } as CompositionContent;
}

describe("collectAssetIds", () => {
  it("junta assetId de image, video (asset + poster) y gallery, sin duplicados, en cualquier profundidad", () => {
    const raw = composition([
      { type: "image", id: "img-1", content: { assetId: "asset-a", altText: "x" } },
      {
        type: "video",
        id: "v-1",
        content: { source: { kind: "asset", assetId: "asset-b", posterAssetId: "asset-c" }, autoplay: false },
      },
      { type: "gallery", id: "g-1", content: { items: [{ assetId: "asset-a", altText: "x" }, { assetId: "asset-d", altText: "y" }] } },
      {
        type: "row",
        id: "inner-row",
        children: [{ type: "image", id: "img-2", content: { assetId: "asset-e", altText: "x" } }],
      },
    ]);

    expect(new Set(collectAssetIds(raw))).toEqual(new Set(["asset-a", "asset-b", "asset-c", "asset-d", "asset-e"]));
  });

  it("ignora video con source embed (sin assetId) y devuelve vacío si no hay ningún nodo de media", () => {
    const raw = composition([
      { type: "video", id: "v-1", content: { source: { kind: "embed", embedUrl: "https://youtube.com/x" }, autoplay: false } },
      { type: "divider", id: "d-1", content: {} },
    ]);

    expect(collectAssetIds(raw)).toEqual([]);
  });
});
