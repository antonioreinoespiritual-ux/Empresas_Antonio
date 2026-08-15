"use client";

import { useState } from "react";
import type { CompositionContent, ElementNode, InnerRowNode, RowNode, SectionNode } from "@repo/core/domain";
import { Button, Select } from "@repo/admin-ui/primitives";
import { COMPOSITION_ROOT_ID } from "@repo/core/domain";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ELEMENT_TYPES, ELEMENT_TYPE_LABELS } from "./node-defaults";

export type AddableType = (typeof ELEMENT_TYPES)[number] | "row" | "section";

/** Prefijo de id para la zona "soltar al final" de cada contenedor — nunca colisiona con un id de nodo real (Fase 3, ids de nodo). */
const END_ZONE_PREFIX = "end-zone:";

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
  /**
   * Fase 6b: soltar un nodo arrastrado dentro de `destParentId`. `beforeNodeId`
   * es el id de hijo existente de `destParentId` delante del cual insertarlo,
   * o `null` para insertarlo al final (zona de soltar). Mismo padre origen y
   * destino = reordenar; distinto = mover de contenedor. El índice numérico
   * se resuelve en el caller, que sí tiene el árbol completo.
   */
  onDragMove: (nodeId: string, sourceParentId: string, destParentId: string, beforeNodeId: string | null) => void;
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

/** Zona invisible al final de cada lista de hijos — soltar acá siempre significa "al final de este contenedor", incluso si está vacío. */
function DropEndZone({ parentId, isOnlyChild }: { parentId: string; isOnlyChild: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${END_ZONE_PREFIX}${parentId}`, data: { parentId, isEndZone: true } });
  return (
    <div
      ref={setNodeRef}
      className={`h-2 rounded ${isOver ? "bg-accent/30 ring-1 ring-accent" : ""} ${isOnlyChild ? "hidden" : ""}`}
    />
  );
}

function DragHandle({ attributes, listeners }: { attributes: DraggableAttributes; listeners: DraggableSyntheticListeners }) {
  return (
    <button
      type="button"
      className="w-4 shrink-0 cursor-grab touch-none text-ink-muted active:cursor-grabbing"
      aria-label="Arrastrar para mover"
      {...attributes}
      {...listeners}
    >
      ⠿
    </button>
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    data: { parentId },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm ${isSelected ? "bg-accent/10 ring-1 ring-accent" : "hover:bg-surface-sunken"} ${isDragging ? "opacity-40" : ""}`}
    >
      <DragHandle attributes={attributes} listeners={listeners} />
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
  const childIds = row.children.map((child) => child.id);

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
          <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
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
          </SortableContext>
          <DropEndZone parentId={row.id} isOnlyChild={row.children.length <= 1} />
          <AddMenu options={addOptions} onAdd={(type) => cb.onAdd(row.id, type)} />
        </div>
      )}
    </div>
  );
}

function SectionSubtree({ section, index, siblingCount, cb }: { section: SectionNode; index: number; siblingCount: number; cb: TreeCallbacks }) {
  const [expanded, setExpanded] = useState(true);
  const childIds = section.children.map((row) => row.id);

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
          <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
            {section.children.map((row, rowIndex) => (
              <RowSubtree key={row.id} row={row} allowInnerRow index={rowIndex} siblingCount={section.children.length} parentId={section.id} cb={cb} />
            ))}
          </SortableContext>
          <DropEndZone parentId={section.id} isOnlyChild={section.children.length <= 1} />
          <AddMenu options={[{ value: "row", label: "Fila" }]} onAdd={(type) => cb.onAdd(section.id, type)} />
        </div>
      )}
    </div>
  );
}

/** Toda la Composition es un solo árbol homogéneo de ids únicos — alcanza con recorrerlo una vez para etiquetar cada nodo por su tipo, usado en el `DragOverlay`. */
function findLabelById(composition: CompositionContent, id: string): string | undefined {
  function walk(nodes: (ElementNode | RowNode | InnerRowNode | SectionNode)[]): string | undefined {
    for (const node of nodes) {
      if (node.id === id) return nodeLabel(node);
      if ("children" in node && node.children) {
        const found = walk(node.children as (ElementNode | RowNode | InnerRowNode | SectionNode)[]);
        if (found) return found;
      }
    }
    return undefined;
  }
  return walk(composition.root);
}

/**
 * Árbol de la Composition (Fase 6a) — expandir/colapsar, seleccionar un nodo
 * para editarlo en el panel aparte. Fase 6b agrega drag-and-drop: reordenar
 * hermanos y mover un nodo a otro row/section arrastrando, además de los
 * botones ↑/↓ ya existentes (que se mantienen, nunca se reemplazan, por
 * accesibilidad y como respaldo). Un solo `DndContext` envuelve todo el
 * árbol; cada contenedor (root, section, row/innerRow) es su propio
 * `SortableContext` acotado a sus hijos directos — el mismo patrón estándar
 * de dnd-kit para listas anidadas multi-contenedor.
 */
export function NodeTree({ composition, ...cb }: { composition: CompositionContent } & TreeCallbacks) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const rootChildIds = composition.root.map((section) => section.id);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const sourceParentId = (active.data.current as { parentId?: string } | undefined)?.parentId;
    if (!sourceParentId) return;

    const overData = over.data.current as { parentId?: string; isEndZone?: boolean } | undefined;
    const destParentId = overData?.parentId;
    if (!destParentId) return;

    if (overData?.isEndZone) {
      cb.onDragMove(String(active.id), sourceParentId, destParentId, null);
      return;
    }
    if (String(over.id) === String(active.id)) return;

    // over es otro nodo: insertarse justo delante de él (lo empuja hacia abajo).
    cb.onDragMove(String(active.id), sourceParentId, destParentId, String(over.id));
  }

  const activeLabel = activeId ? findLabelById(composition, activeId) : undefined;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-1">
        <SortableContext items={rootChildIds} strategy={verticalListSortingStrategy}>
          {composition.root.map((section, index) => (
            <SectionSubtree key={section.id} section={section} index={index} siblingCount={composition.root.length} cb={cb} />
          ))}
        </SortableContext>
        <DropEndZone parentId={COMPOSITION_ROOT_ID} isOnlyChild={composition.root.length <= 1} />
        <AddMenu options={[{ value: "section", label: "Sección" }]} onAdd={(type) => cb.onAdd(COMPOSITION_ROOT_ID, type)} />
      </div>
      <DragOverlay>{activeLabel ? <div className="rounded-md bg-surface px-2 py-1 text-sm shadow-lg ring-1 ring-accent">{activeLabel}</div> : null}</DragOverlay>
    </DndContext>
  );
}
