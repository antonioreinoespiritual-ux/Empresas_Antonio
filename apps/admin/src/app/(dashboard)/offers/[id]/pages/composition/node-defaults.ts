import type { ElementNode, ElementNodeType } from "@repo/core/domain";

// Fábricas de nodos nuevos (Fase 6a) — cada una produce un nodo YA válido
// contra el schema de dominio (nunca placeholders vacíos tipo `assetId: ""`
// o `embedUrl: "https://"` sin host): `addNodeToComposition` re-valida el
// árbol completo apenas se agrega un nodo (a diferencia de LandingBlocksForm,
// que solo valida al guardar), así que un default inválido rompería el
// "agregar" mismo, no recién el guardado.
export const ELEMENT_TYPES: ElementNodeType[] = ["richText", "image", "video", "gallery", "icon", "divider", "button", "spacer", "shape"];

export const ELEMENT_TYPE_LABELS: Record<ElementNodeType, string> = {
  richText: "Texto",
  image: "Imagen",
  video: "Video",
  gallery: "Galería",
  icon: "Ícono",
  divider: "Separador",
  button: "Botón",
  spacer: "Espaciador",
  shape: "Forma decorativa",
  legacyBlock: "Bloque clásico",
};

function newId(): string {
  return crypto.randomUUID();
}

export function newElement(type: ElementNodeType): ElementNode {
  const id = newId();
  switch (type) {
    case "richText":
      return { type: "richText", id, content: [{ style: "p", children: [{ text: "Texto", marks: [] }] }] };
    case "image":
      return { type: "image", id, content: { assetId: "pending-select-asset", altText: "Descripción de la imagen" } };
    case "video":
      return { type: "video", id, content: { source: { kind: "embed", embedUrl: "https://example.com" }, autoplay: false } };
    case "gallery":
      return { type: "gallery", id, content: { items: [{ assetId: "pending-select-asset", altText: "Descripción de la imagen" }] } };
    case "icon":
      return { type: "icon", id, content: { name: "star" } };
    case "divider":
      return { type: "divider", id, content: {} };
    case "button":
      return { type: "button", id, content: { label: "Comprar ahora", href: "https://example.com" } };
    case "spacer":
      return { type: "spacer", id, content: {} };
    case "shape":
      return { type: "shape", id, content: { variant: "dot" } };
    case "legacyBlock":
      throw new Error("legacyBlock no se agrega desde cero en el editor de Composition — solo se edita si ya existe.");
    default: {
      const exhaustive: never = type;
      throw new Error(`Tipo de elemento desconocido: ${exhaustive}`);
    }
  }
}

/** Row nueva con un elemento por defecto adentro — `children.min(1)` del schema exige que nunca exista una row vacía, ni siquiera transitoriamente. */
export function newRow() {
  return { type: "row" as const, id: newId(), children: [newElement("richText")] };
}

/** Section nueva con una row (con su elemento) adentro — mismo motivo que newRow. */
export function newSection() {
  return { type: "section" as const, id: newId(), children: [newRow()] };
}
