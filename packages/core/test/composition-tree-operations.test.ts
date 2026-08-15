import { describe, expect, it } from "vitest";
import {
  addNodeToComposition,
  COMPOSITION_ROOT_ID,
  ConflictError,
  DomainError,
  NotFoundError,
  reorderChildrenInComposition,
  removeNodeFromComposition,
  updateNodeInComposition,
  type CompositionContent,
} from "../src/domain";

function baseComposition(): CompositionContent {
  return {
    version: "composition-1",
    root: [
      {
        type: "section",
        id: "sec-1",
        children: [
          {
            type: "row",
            id: "row-1",
            children: [{ type: "spacer", id: "el-1", content: {} }],
          },
        ],
      },
    ],
  };
}

describe("tree-operations: agregar nodos en cualquier profundidad", () => {
  it("agrega una section nueva al root con COMPOSITION_ROOT_ID", () => {
    const next = addNodeToComposition(baseComposition(), COMPOSITION_ROOT_ID, {
      type: "section",
      id: "sec-2",
      children: [{ type: "row", id: "row-2", children: [{ type: "spacer", id: "el-2", content: {} }] }],
    });
    expect(next.root).toHaveLength(2);
    expect(next.root[1]?.id).toBe("sec-2");
  });

  it("agrega una row dentro de una section existente", () => {
    const next = addNodeToComposition(baseComposition(), "sec-1", {
      type: "row",
      id: "row-new",
      children: [{ type: "spacer", id: "el-new", content: {} }],
    });
    const section = next.root[0];
    expect(section?.children).toHaveLength(2);
    expect(section?.children[1]?.id).toBe("row-new");
  });

  it("agrega un elemento dentro de una row existente", () => {
    const next = addNodeToComposition(baseComposition(), "row-1", {
      type: "divider",
      id: "div-new",
      content: {},
    });
    expect(next.root[0]?.children[0]?.children).toHaveLength(2);
  });

  it("agrega una row anidada (nivel 3) dentro de una row de nivel 2 — permitido", () => {
    const next = addNodeToComposition(baseComposition(), "row-1", {
      type: "row",
      id: "inner-row",
      children: [{ type: "spacer", id: "el-inner", content: {} }],
    });
    const innerRow = next.root[0]?.children[0]?.children.find((c) => c.id === "inner-row");
    expect(innerRow).toBeDefined();
  });

  it("rechaza agregar una row dentro de una row ya anidada (5º nivel) — el re-parseo del árbol completo lo revienta", () => {
    const withInnerRow = addNodeToComposition(baseComposition(), "row-1", {
      type: "row",
      id: "inner-row",
      children: [{ type: "spacer", id: "el-inner", content: {} }],
    });
    expect(() =>
      addNodeToComposition(withInnerRow, "inner-row", {
        type: "row",
        id: "too-deep",
        children: [{ type: "spacer", id: "el-too-deep", content: {} }],
      })
    ).toThrow();
  });

  it("lanza ConflictError si el id ya existe en algún lado del árbol", () => {
    expect(() => addNodeToComposition(baseComposition(), "row-1", { type: "divider", id: "el-1", content: {} })).toThrow(
      ConflictError
    );
  });

  it("lanza NotFoundError si el parentId no existe", () => {
    expect(() => addNodeToComposition(baseComposition(), "no-existe", { type: "divider", id: "x", content: {} })).toThrow(
      NotFoundError
    );
  });

  it("lanza DomainError si el parentId no es un contenedor (es un elemento hoja)", () => {
    expect(() => addNodeToComposition(baseComposition(), "el-1", { type: "divider", id: "x", content: {} })).toThrow(DomainError);
  });
});

describe("tree-operations: actualizar un nodo por id, sin importar la profundidad", () => {
  it("actualiza content y style de un nodo existente", () => {
    const next = updateNodeInComposition(baseComposition(), "el-1", {
      content: {},
      style: { spacing: { top: "lg" } },
    });
    const el = next.root[0]?.children[0]?.children[0];
    if (!el || el.type === "legacyBlock") throw new Error("se esperaba un nodo con style (spacer)");
    expect(el.style).toEqual({ spacing: { top: "lg" } });
  });

  it("lanza NotFoundError para un id inexistente", () => {
    expect(() => updateNodeInComposition(baseComposition(), "no-existe", { content: {} })).toThrow(NotFoundError);
  });
});

describe("tree-operations: eliminar un nodo por id", () => {
  it("elimina un elemento hoja y el árbol sigue siendo válido", () => {
    const withExtra = addNodeToComposition(baseComposition(), "row-1", { type: "divider", id: "div-1", content: {} });
    const next = removeNodeFromComposition(withExtra, "div-1");
    expect(next.root[0]?.children[0]?.children).toHaveLength(1);
  });

  it("lanza NotFoundError para un id inexistente", () => {
    expect(() => removeNodeFromComposition(baseComposition(), "no-existe")).toThrow(NotFoundError);
  });
});

describe("tree-operations: reordenar los hijos directos de un contenedor", () => {
  it("reordena los hijos de una row", () => {
    const withExtra = addNodeToComposition(baseComposition(), "row-1", { type: "divider", id: "div-1", content: {} });
    const next = reorderChildrenInComposition(withExtra, "row-1", ["div-1", "el-1"]);
    expect(next.root[0]?.children[0]?.children.map((c) => c.id)).toEqual(["div-1", "el-1"]);
  });

  it("lanza DomainError si faltan o sobran ids", () => {
    expect(() => reorderChildrenInComposition(baseComposition(), "row-1", [])).toThrow(DomainError);
  });

  it("reordena las sections del root con COMPOSITION_ROOT_ID", () => {
    const withExtra = addNodeToComposition(baseComposition(), COMPOSITION_ROOT_ID, {
      type: "section",
      id: "sec-2",
      children: [{ type: "row", id: "row-2", children: [{ type: "spacer", id: "el-2", content: {} }] }],
    });
    const next = reorderChildrenInComposition(withExtra, COMPOSITION_ROOT_ID, ["sec-2", "sec-1"]);
    expect(next.root.map((s) => s.id)).toEqual(["sec-2", "sec-1"]);
  });
});
