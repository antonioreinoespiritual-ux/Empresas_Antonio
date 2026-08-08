import { Container, Heading, Section, Text } from "../primitives";
import type { FaqBlockContent } from "./types";

/** Acordeón sin JS: <details> nativo — accesible por teclado y lector de pantalla sin costo de hidratación. */
export function FaqBlock({ content }: { content: FaqBlockContent }) {
  return (
    <Section tone="base">
      <Container width="content">
        {content.heading && (
          <Heading as="h2" className="mb-8 text-center">
            {content.heading}
          </Heading>
        )}
        <div className="divide-y divide-border">
          {content.items.map((item, index) => (
            <details key={index} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-sans font-semibold text-foreground">
                {item.question}
                <span className="shrink-0 text-foreground-muted transition-transform duration-base group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <Text tone="muted" className="mt-3">
                {item.answer}
              </Text>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
