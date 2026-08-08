/**
 * Los mismos 4 ids que packages/ui/src/themes/presets.ts — duplicados a
 * propósito, no importados desde ahí: domain no puede depender de un
 * paquete de componentes React (ver .dependency-cruiser.cjs). packages/ui
 * es dueño de cómo se ve cada preset; domain solo necesita saber cuáles
 * ids son válidos para poder rechazar un valor manipulado server-side.
 */
export const THEME_IDS = ["premium-light", "premium-dark", "editorial", "high-conversion"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME_ID: ThemeId = "premium-light";

export function isValidThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value);
}
