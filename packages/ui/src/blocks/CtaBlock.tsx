import { Button, Container, Heading, Section, Stack, Text } from "../primitives";
import type { CtaBlockContent } from "./types";

/**
 * Bookend de cierre — fondo invertido, siempre buttonPreset="solid" sin
 * importar el theme. "outline-accent" (Editorial) es ilegible sobre un
 * fondo ya invertido (hallazgo real de la verificación visual de B1); el
 * propósito de este bloque es máximo contraste, no consistencia de preset.
 */
export function CtaBlock({ content, checkoutHref }: { content: CtaBlockContent; checkoutHref: string }) {
  return (
    <Section tone="inverted">
      <Container width="content" className="text-center">
        <Stack gap="md" align="center">
          {content.headline && <Heading as="h2">{content.headline}</Heading>}
          {content.subtext && <Text className="mx-auto">{content.subtext}</Text>}
          <a href={checkoutHref}>
            <Button variant="primary" size="lg" buttonPreset="solid">
              {content.buttonLabel}
            </Button>
          </a>
        </Stack>
      </Container>
    </Section>
  );
}
