import { Container, Section } from "../primitives";
import { sanitizeRichTextHtml } from "../sanitize";
import type { RichTextBlockContent } from "./types";

/**
 * Único bloque que renderiza HTML — lo escribe un admin autenticado, no un
 * usuario final, pero igual pasa por `sanitizeRichTextHtml` (Fase 8): un
 * admin puede copiar/pegar contenido de otro lado sin darse cuenta de qué
 * trae adentro, y esta es la última barrera antes del DOM. Ver la nota
 * equivalente en el renderer legacy de /[slug].
 */
export function RichTextBlock({ content }: { content: RichTextBlockContent }) {
  return (
    <Section tone="base">
      <Container width="content">
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(content.html) }} />
      </Container>
    </Section>
  );
}
