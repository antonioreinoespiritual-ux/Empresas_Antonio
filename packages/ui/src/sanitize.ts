import sanitizeHtml from "sanitize-html";

// Fase 8 (ARCH-LANDING-EDITOR-02, hardening de deuda preexistente — §1.6
// punto 4): los dos únicos sitios del repo que renderizan HTML crudo
// escrito por un admin (`bodyHtml` legacy y `richText.html` de bloques)
// nunca pasaban por un sanitizador — ambos confiaban en "solo un admin
// autenticado lo escribe". Esto cierra esa brecha sin tocar el modelo de
// datos: mismo campo `string`, mismo `<Textarea>` de edición, el HTML
// simplemente se limpia antes de inyectarse en el DOM. El árbol nuevo de
// Composition (`richTextDocSchema`, Fase 4) no usa esta vía — nunca
// parsea HTML, así que no la necesita (ver RichTextNode.tsx).
const ALLOWED_TAGS = [
  "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "sub", "sup",
  "ul", "ol", "li", "blockquote", "a", "img", "span", "div",
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "title", "width", "height"],
  "*": ["class"],
};

/**
 * Sanitiza HTML de admin antes de `dangerouslySetInnerHTML`. Nunca
 * `script`/`iframe`/`object`/`embed`/`style`, nunca atributos `on*`, nunca
 * `javascript:`/`data:` en `href`/`src` — solo `http(s)`/`mailto` (imágenes
 * además admiten `data:` para pegar un base64 chico, caso real de copiar
 * contenido desde otro editor).
 */
export function sanitizeRichTextHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowProtocolRelative: false,
    // rel="noopener noreferrer" en cualquier link con target — evita que un
    // link con `target="_blank"` en HTML de admin le dé `window.opener` a la
    // pestaña nueva (tabnabbing), sin depender de que quien lo escribió se
    // haya acordado de ponerlo.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
    },
  });
}
