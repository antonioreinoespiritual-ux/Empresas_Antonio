import { Container, Section } from "../primitives";
import type { RichTextBlockContent } from "./types";

/**
 * Único bloque que renderiza HTML — el mismo nivel de confianza que
 * bodyHtml en el flujo legacy: lo escribe un admin autenticado, no un
 * usuario final. Ver la nota equivalente en el renderer legacy de /[slug].
 */
export function RichTextBlock({ content }: { content: RichTextBlockContent }) {
  return (
    <Section tone="base">
      <Container width="content">
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: content.html }} />
      </Container>
    </Section>
  );
}
