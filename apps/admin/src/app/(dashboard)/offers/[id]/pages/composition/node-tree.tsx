"use client";

import { useState } from "react";
import type { CompositionContent, ElementNode, InnerRowNode, RowNode, SectionNode } from "@repo/core/domain";
import { Button, Select } from "@repo/admin-ui/primitives";
import { COMPOSITION_ROOT_ID } from "@repo/core/domain";
import { ELEMENT_TYPES, ELEMENT_TYPE_LABELS } from "./node-defaults";

export type AddableType = (typeof ELEMENT_TYPES)[number] | "row" | "section";

function nodeLabel(node: ElementNode | RowNode | InnerRowNode | SectionNode): string {
  switch (node.type) {
    case "section":
      return "Sección";
    case "row":
      return "Fila";
    case "richText":
      return node.content[0]?.children[0]?.text || "Texto";
    case "image":
      return node.content.altText || "Imagen";
    case "video":
      return node.content.source.kind === "embed" ? "Video (embed)" : "Video (propio)";
    case "gallery":
      return `Galería (${node.content.items.length})`;
    case "icon":
      return `Ícono: ${node.content.name}`;
    case "button":
      return `Botón: ${node.content.label}`;
    case "shape":
      return `Forma: ${node.content.variant}`;
    case "divider":
      return "Separador";
    case "spacer":
      return "Espaciador";
    case "legacyBlock":
      return `Bloque clásico: ${node.content.block.type}`;
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}

interface TreeCallbacks {
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
  onAdd: (parentId: string, type: AddableType) => void;
  onRemove: (nodeId: string) => void;
  onMove: (parentId: string, nodeId: string, direction: -1 | 1) => void;
}

function AddMenu({ options, onAdd }: { options: { value: AddableType; label: string }[]; onAdd: (type: AddableType) => void }) {
  const [type, setType] = useState<AddableType>(options[0]!.value);
  return (
    <div className="flex items-center gap-1.5">
      <Select className="h-7 w-auto text-xs" value={type} onChange={(e) => setType(e.target.value as AddableType)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
      <Button type="button" variant="secondary" size="sm" onClick={() => onAdd(type)}>
        + Agregar
      </Button>
    </div>
  );
}

function NodeRow({
  node,
  removable,
  onToggleExpand,
  expanded,
  hasChildren,
  index,
  siblingCount,
  parentId,
  cb,
}: {
  node: ElementNode | RowNode | InnerRowNode | SectionNode;
  removable: boolean;
  onToggleExpand?: () => void;
  expanded?: boolean;
  hasChildren: boolean;
  index: number;
  siblingCount: number;
  parentId: string;
  cb: TreeCallbacks;
}) {
  const isSelected = cb.selectedNodeId === node.id;
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm ${isSelected ? "bg-accent/10 ring-1 ring-accent" : "hover:bg-surface-sunken"}`}
    >
      {hasChildren ? (
        <button type="button" onClick={onToggleExpand} className="w-4 shrink-0 text-ink-muted" aria-label="Expandir/colapsar">
          {expanded ? "▾" : "▸"}
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <button type="button" onClick={() => cb.onSelect(node.id)} className="flex-1 truncate text-left text-ink">
        <span className="text-xs font-medium text-ink-muted">{node.type}</span> — {nodeLabel(node)}
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button type="button" variant="ghost" size="sm" onClick={() => cb.onMove(parentId, node.id, -1)} disabled={index === 0} aria-label="Mover arriba">
          ↑
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => cb.onMove(parentId, node.id, 1)}
          disabled={index === siblingCount - 1}
          aria-label="Mover abajo"
        >
          ↓
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={() => cb.onRemove(node.id)} disabled={!removable}>
          Eliminar
        </Button>
      </div>
    </div>
  );
}

const ELEMENT_ADD_OPTIONS = ELEMENT_TYPES.map((type) => ({ value: type as AddableType, label: ELEMENT_TYPE_LABELS[type] }));

function ElementLeaf({ node, index, siblingCount, parentId, cb }: { node: ElementNode; index: number; siblingCount: number; parentId: string; cb: TreeCallbacks }) {
  return <NodeRow node={node} removable={siblingCount > 1} hasChildren={false} index={index} siblingCount={siblingCount} parentId={parentId} cb={cb} />;
}

/** Fila: sus hijos son elementos, y — solo si `allowInnerRow` (fila de nivel 2, hija directa de una section) — también otra fila anidada (P-1, profundidad máxima). */
function RowSubtree({
  row,
  allowInnerRow,
  index,
  siblingCount,
  parentId,
  cb,
}: {
  row: RowNode | InnerRowNode;
  allowInnerRow: boolean;
  index: number;
  siblingCount: number;
  parentId: string;
  cb: TreeCallbacks;
}) {
  const [expanded, setExpanded] = useState(true);
  const addOptions = allowInnerRow ? [...ELEMENT_ADD_OPTIONS, { value: "row" as AddableType, label: "Fila anidada" }] : ELEMENT_ADD_OPTIONS;

  return (
    <div>
      <NodeRow
        node={row}
        removable={siblingCount > 1}
        hasChildren
        expanded={expanded}
        onToggleExpand={() => setExpanded((prev) => !prev)}
        index={index}
        siblingCount={siblingCount}
        parentId={parentId}
        cb={cb}
      />
      {expanded && (
        <div className="ml-5 flex flex-col gap-1 border-l border-border pl-2">
          {row.children.map((child, childIndex) =>
            child.type === "row" ? (
              <RowSubtree
                key={child.id}
                row={child}
                allowInnerRow={false}
                index={childIndex}
                siblingCount={row.children.length}
                parentId={row.id}
                cb={cb}
              />
            ) : (
              <ElementLeaf key={child.id} node={child} index={childIndex} siblingCount={row.children.length} parentId={row.id} cb={cb} />
            )
          )}
          <AddMenu options={addOptions} onAdd={(type) => cb.onAdd(row.id, type)} />
        </div>
      )}
    </div>
  );
}

function SectionSubtree({ section, index, siblingCount, cb }: { section: SectionNode; index: number; siblingCount: number; cb: TreeCallbacks }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div>
      <NodeRow
        node={section}
        removable={siblingCount > 1}
        hasChildren
        expanded={expanded}
        onToggleExpand={() => setExpanded((prev) => !prev)}
        index={index}
        siblingCount={siblingCount}
        parentId={COMPOSITION_ROOT_ID}
        cb={cb}
      />
      {expanded && (
        <div className="ml-5 flex flex-col gap-1 border-l border-border pl-2">
          {section.children.map((row, rowIndex) => (
            <RowSubtree key={row.id} row={row} allowInnerRow index={rowIndex} siblingCount={section.children.length} parentId={section.id} cb={cb} />
          ))}
          <AddMenu options={[{ value: "row", label: "Fila" }]} onAdd={(type) => cb.onAdd(section.id, type)} />
        </div>
      )}
    </div>
  );
}

/**
 * Árbol de la Composition (Fase 6a) — expandir/colapsar, mover por id (no
 * por índice, a diferencia del editor de bloques legacy), seleccionar un
 * nodo para editarlo en el panel aparte. Sin drag-and-drop (§ plan, 6a).
 */
export function NodeTree({ composition, ...cb }: { composition: CompositionContent } & TreeCallbacks) {
  return (
    <div className="flex flex-col gap-1">
      {composition.root.map((section, index) => (
        <SectionSubtree key={section.id} section={section} index={index} siblingCount={composition.root.length} cb={cb} />
      ))}
      <AddMenu options={[{ value: "section", label: "Sección" }]} onAdd={(type) => cb.onAdd(COMPOSITION_ROOT_ID, type)} />
    </div>
  );
}
