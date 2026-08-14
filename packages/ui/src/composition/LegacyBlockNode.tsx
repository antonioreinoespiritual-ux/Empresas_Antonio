import type { Theme } from "../themes/types";
import { LandingBlockDispatch } from "../blocks";
import type { LegacyBlockNodeContent } from "./types";

/**
 * Envuelve 1 de los 8 LandingBlock existentes tal cual, reusando el mismo
 * dispatch que LandingRenderer (ARCH-LANDING-EDITOR-02 §11) — cero
 * duplicación del switch por tipo de bloque legacy.
 */
export function LegacyBlockNode({ content, theme, checkoutHref }: { content: LegacyBlockNodeContent; theme: Theme; checkoutHref: string }) {
  return (
    <div data-node-id={content.id}>
      <LandingBlockDispatch block={content.content.block} theme={theme} checkoutHref={checkoutHref} />
    </div>
  );
}
