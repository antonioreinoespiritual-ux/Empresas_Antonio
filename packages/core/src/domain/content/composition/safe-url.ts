import { z } from "zod";

// z.string().url() por sí solo acepta cualquier esquema con esa forma —
// incluido "javascript:alert(1)", que la validación WHATWG de URL de Zod
// considera válida. Todo campo nuevo de Composition que sea un link
// navegable por el visitante final (no una URL de imagen/video externa ya
// existente en otros bloques) debe pasar por este schema en vez de
// `z.string().url()` a secas (ARCH-LANDING-EDITOR-02 §13).
const ALLOWED_LINK_PROTOCOLS = new Set(["https:", "mailto:"]);

export const safeLinkUrlSchema = z.string().url().refine(
  (value) => {
    try {
      return ALLOWED_LINK_PROTOCOLS.has(new URL(value).protocol);
    } catch {
      return false;
    }
  },
  { message: "protocolo no permitido (solo https/mailto)" }
);
