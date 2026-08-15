// Editor de landings v2, Fase 5 (ARCH-LANDING-EDITOR-02 §7) — biblioteca de
// medios compartida entre Offers. `url` siempre la computa el servidor a
// partir de `path` (MediaStorage.publicUrlFor), nunca un valor que el
// cliente pueda pasar libremente al registrar el Asset — mismo criterio de
// "nunca confiar una URL suelta del cliente" que ya aplica `safeLinkUrlSchema`
// dentro de Composition.
export type AssetKind = "IMAGE" | "VIDEO";

export interface Asset {
  id: string;
  kind: AssetKind;
  url: string;
  width: number | null;
  height: number | null;
  altText: string;
  provider: string;
  createdAt: Date;
}
