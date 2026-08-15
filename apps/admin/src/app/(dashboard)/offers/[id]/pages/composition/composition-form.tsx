"use client";

import { useState } from "react";
import {
  addNodeToComposition,
  COMPOSITION_ROOT_ID,
  removeNodeFromComposition,
  reorderChildrenInComposition,
  updateNodeInComposition,
  type CompositionContent,
  type CompositionNode,
  type Page,
} from "@repo/core/domain";
import { Button, Card, Field, Input, useToast } from "@repo/admin-ui/primitives";
import { savePageAction } from "../actions";
import { NodeContentEditor } from "./node-content-editor";
import { newElement, newRow, newSection } from "./node-defaults";
import { AddableType, NodeTree } from "./node-tree";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

const EMPTY_COMPOSITION: CompositionContent = { version: "composition-1", root: [newSection()] };

function isComposition(content: unknown): content is CompositionContent {
  return Boolean(content && typeof content === "object" && (content as Record<string, unknown>).version === "composition-1");
}

interface TreeNode {
  id: string;
  children?: TreeNode[];
  [key: string]: unknown;
}

function asTree(composition: CompositionContent): TreeNode {
  return { id: COMPOSITION_ROOT_ID, children: composition.root as unknown as TreeNode[] };
}

function findNode(node: TreeNode, id: string): TreeNode | undefined {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

function findParentType(node: TreeNode, targetId: string): string | undefined {
  for (const child of node.children ?? []) {
    if (child.id === targetId) return node.type as string | undefined;
    const deeper = findParentType(child, targetId);
    if (deeper) return deeper;
  }
  return undefined;
}

function newNodeForType(type: AddableType) {
  if (type === "section") return newSection();
  if (type === "row") return newRow();
  return newElement(type);
}

/**
 * Editor visual estructurado de Composition (Fase 6a, ARCH-LANDING-EDITOR-02
 * §21 Fase 6). Todas las mutaciones del árbol pasan por las mismas funciones
 * puras de dominio que usa el Agent Access Layer (`add/update/remove/reorder
 * NodeInComposition`) — garantiza que lo que un humano arma acá siempre es
 * exactamente igual de válido que lo que arma un agente, sin reglas de
 * validación duplicadas. Guarda con el mismo `savePageAction`/CAS de
 * `page.version` que ya usan los demás forms — coexiste sin pisar cambios
 * de un agente concurrente (§ gate de cierre 6a).
 */
export function CompositionForm({ offerId, page }: { offerId: string; page: Page | null }) {
  const { show } = useToast();
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [content, setContent] = useState<CompositionContent>(() => (isComposition(page?.content) ? page!.content : EMPTY_COMPOSITION));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tree = asTree(content);
  const selectedNode = selectedNodeId ? (findNode(tree, selectedNodeId) as unknown as CompositionNode | undefined) : undefined;
  const selectedParentType = selectedNodeId ? findParentType(tree, selectedNodeId) : undefined;

  function handleAdd(parentId: string, type: AddableType) {
    setError(null);
    try {
      setContent(addNodeToComposition(content, parentId, newNodeForType(type)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar el nodo");
    }
  }

  function handleRemove(nodeId: string) {
    setError(null);
    try {
      setContent(removeNodeFromComposition(content, nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el nodo");
    }
  }

  function handleMove(parentId: string, nodeId: string, direction: -1 | 1) {
    setError(null);
    try {
      const parent = findNode(tree, parentId);
      const ids = (parent?.children ?? []).map((child) => child.id);
      const from = ids.indexOf(nodeId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= ids.length) return;
      const next = [...ids];
      [next[from], next[to]] = [next[to]!, next[from]!];
      setContent(reorderChildrenInComposition(content, parentId, next));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo mover el nodo");
    }
  }

  function handleUpdate(patch: { content?: unknown; style?: unknown }) {
    if (!selectedNodeId) return;
    setError(null);
    try {
      setContent(updateNodeInComposition(content, selectedNodeId, patch));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el nodo");
    }
  }

  async function onSubmit() {
    setError(null);
    if (!SLUG_PATTERN.test(slug)) {
      setError("El slug es obligatorio: solo minúsculas, números y guiones.");
      return;
    }
    setIsSubmitting(true);
    const result = await savePageAction({ offerId, kind: "LANDING", slug, content, expectedVersion: page?.version });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "No se pudo guardar");
      return;
    }
    show("Composition guardada");
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-ink">Página de ventas — editor visual (Composition)</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Secciones → filas → elementos, con columnas, media real y texto con estilo. Reemplaza a los editores de arriba
        cuando se guarda acá: los tres escriben al mismo Page, gana el que se guardó al último.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <Field label="Slug (URL)">
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-md border border-border p-2">
            <NodeTree
              composition={content}
              selectedNodeId={selectedNodeId}
              onSelect={setSelectedNodeId}
              onAdd={handleAdd}
              onRemove={handleRemove}
              onMove={handleMove}
            />
          </div>
          <div className="rounded-md border border-border p-3">
            {selectedNode ? (
              <NodeContentEditor
                node={selectedNode}
                isRowChild={selectedParentType === "row"}
                onChangeContent={(next) => handleUpdate({ content: next })}
                onChangeStyle={(next) => handleUpdate({ style: next })}
              />
            ) : (
              <p className="text-sm text-ink-muted">Seleccioná un nodo del árbol para editarlo.</p>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="button" disabled={isSubmitting} className="self-start" onClick={onSubmit}>
          Guardar Composition
        </Button>
      </div>
    </Card>
  );
}
