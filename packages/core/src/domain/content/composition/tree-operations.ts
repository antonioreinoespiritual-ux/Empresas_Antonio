import { ConflictError, DomainError, NotFoundError } from "../../shared/domain-error";
import { compositionContentSchema, type CompositionContent } from "./node";

// Transformaciones puras sobre el árbol de una Composition — Fase 3
// (ARCH-LANDING-EDITOR-02, escritura agentic). Mismo criterio que
// block-operations.ts: sin I/O, nunca mutan el `composition` recibido,
// devuelven contenido nuevo listo para persistir. A diferencia de los
// bloques (array plano), acá el mismo nodo puede estar en cualquier
// profundidad, así que estas funciones recorren el árbol por `id` en vez de
// indexar directo un array.
//
// Estrategia de validación: cada función clona, muta el clon como JS plano,
// y SIEMPRE re-valida el árbol completo con `compositionContentSchema`
// antes de devolverlo. Eso es lo que realmente impide, por ejemplo, agregar
// una row dentro de una row ya anidada (P-1, profundidad máxima 4 niveles)
// — el propio schema lo rechaza, no hace falta un chequeo de profundidad
// escrito a mano acá.

/** Id sentinel para "la raíz de la Composition" — agregar/reordenar con este id opera directo sobre `composition.root` (la lista de sections). */
export const COMPOSITION_ROOT_ID = "root";

interface TreeNode {
  id: string;
  children?: TreeNode[];
  [key: string]: unknown;
}

function cloneAsTree(composition: CompositionContent): TreeNode {
  return { id: COMPOSITION_ROOT_ID, children: structuredClone(composition.root) as unknown as TreeNode[] };
}

function toComposition(root: TreeNode): CompositionContent {
  return compositionContentSchema.parse({ version: "composition-1", root: root.children });
}

function findNodeById(node: TreeNode, targetId: string): TreeNode | undefined {
  if (node.id === targetId) return node;
  if (!node.children) return undefined;
  for (const child of node.children) {
    const found = findNodeById(child, targetId);
    if (found) return found;
  }
  return undefined;
}

function findNodeAndParent(node: TreeNode, targetId: string): { node: TreeNode; parent: TreeNode } | undefined {
  if (!node.children) return undefined;
  for (const child of node.children) {
    if (child.id === targetId) return { node: child, parent: node };
    const deeper = findNodeAndParent(child, targetId);
    if (deeper) return deeper;
  }
  return undefined;
}

/**
 * Agrega `newNode` como hijo de `parentId` (`COMPOSITION_ROOT_ID` para
 * agregar una section nueva al nivel más alto). El propio re-parseo decide
 * si el resultado es válido — p. ej. agregar un nodo `row` dentro de una row
 * ya anidada, o un elemento directo dentro de una section, revienta acá con
 * un ZodError, no con un chequeo de tipo escrito a mano.
 */
export function addNodeToComposition(composition: CompositionContent, parentId: string, newNode: unknown): CompositionContent {
  const root = cloneAsTree(composition);
  const parent = findNodeById(root, parentId);
  if (!parent) throw new NotFoundError(`No existe ningún nodo contenedor con id "${parentId}"`);
  if (!parent.children) throw new DomainError(`El nodo "${parentId}" no admite hijos`);
  const candidate = newNode as TreeNode;
  if (parent.children.some((child) => child.id === candidate.id)) {
    throw new ConflictError(`Ya existe un nodo con id "${candidate.id}"`);
  }
  parent.children.push(candidate);
  return toComposition(root);
}

/**
 * Patch parcial de `content`/`style` de un nodo existente — nunca `type`,
 * `id` ni `children` (la ruta HTTP valida el body con `.strict()` para que
 * esas claves ni siquiera lleguen acá; ver apps/agent-api).
 */
export function updateNodeInComposition(
  composition: CompositionContent,
  nodeId: string,
  patch: { content?: unknown; style?: unknown }
): CompositionContent {
  const root = cloneAsTree(composition);
  const node = findNodeById(root, nodeId);
  if (!node || node === root) throw new NotFoundError(`No existe ningún nodo con id "${nodeId}"`);
  if ("content" in patch) node.content = patch.content;
  if ("style" in patch) node.style = patch.style;
  return toComposition(root);
}

/** No permite eliminar la raíz — solo nodos direccionables dentro del árbol. */
export function removeNodeFromComposition(composition: CompositionContent, nodeId: string): CompositionContent {
  const root = cloneAsTree(composition);
  const found = findNodeAndParent(root, nodeId);
  if (!found) throw new NotFoundError(`No existe ningún nodo con id "${nodeId}"`);
  found.parent.children = (found.parent.children ?? []).filter((child) => child.id !== nodeId);
  return toComposition(root);
}

/** `orderedNodeIds` debe incluir cada hijo directo de `parentId` exactamente una vez — nunca agrega/quita nodos, solo reordena. */
export function reorderChildrenInComposition(
  composition: CompositionContent,
  parentId: string,
  orderedNodeIds: string[]
): CompositionContent {
  const root = cloneAsTree(composition);
  const parent = findNodeById(root, parentId);
  if (!parent) throw new NotFoundError(`No existe ningún nodo contenedor con id "${parentId}"`);
  const children = parent.children ?? [];
  if (orderedNodeIds.length !== children.length || new Set(orderedNodeIds).size !== children.length) {
    throw new DomainError("orderedNodeIds debe incluir cada hijo existente exactamente una vez, sin repetidos");
  }
  const byId = new Map(children.map((child) => [child.id, child] as const));
  const next = orderedNodeIds.map((id) => {
    const child = byId.get(id);
    if (!child) throw new NotFoundError(`El nodo "${parentId}" no tiene ningún hijo con id "${id}"`);
    return child;
  });
  parent.children = next;
  return toComposition(root);
}
