import type { Asset, ElementNode } from "@repo/core/domain";

/** assetId -> Asset ya resuelto — construido por el caller (apps/web) antes de renderizar, nunca por los nodos mismos (Fase 5, §7). */
export type AssetMap = Record<string, Asset>;

export type RichTextNodeContent = Extract<ElementNode, { type: "richText" }>;
export type ImageNodeContent = Extract<ElementNode, { type: "image" }>;
export type VideoNodeContent = Extract<ElementNode, { type: "video" }>;
export type GalleryNodeContent = Extract<ElementNode, { type: "gallery" }>;
export type IconNodeContent = Extract<ElementNode, { type: "icon" }>;
export type DividerNodeContent = Extract<ElementNode, { type: "divider" }>;
export type ButtonNodeContent = Extract<ElementNode, { type: "button" }>;
export type SpacerNodeContent = Extract<ElementNode, { type: "spacer" }>;
export type ShapeNodeContent = Extract<ElementNode, { type: "shape" }>;
export type LegacyBlockNodeContent = Extract<ElementNode, { type: "legacyBlock" }>;
