import { stylePropsToBaseCss } from "./style-runtime";
import type { IconNodeContent } from "./types";

// Mismo criterio que `BenefitsBlock` ya usa para `item.icon` hoy: nombre
// libre, sin catálogo cerrado — resolverlo a un ícono real es una decisión
// de renderer futura, no del dominio. `aria-hidden`: es decorativo salvo que
// vaya acompañado de texto propio, que el nodo vecino ya provee.
// Sin ResponsiveStyleTag acá a propósito: es un <span> (contenido de
// fraseo), y <style> no es contenido de fraseo válido dentro de un <span>
// — a diferencia de los nodos que envuelven en <div>, donde sí corresponde.
export function IconNode({ content }: { content: IconNodeContent }) {
  return (
    <span data-node-id={content.id} aria-hidden="true" className="block text-2xl" style={stylePropsToBaseCss(content.style)}>
      {content.content.name}
    </span>
  );
}
