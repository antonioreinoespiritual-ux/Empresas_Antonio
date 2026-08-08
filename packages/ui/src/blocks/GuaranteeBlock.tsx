import { Card, Container, Heading, Section, Text } from "../primitives";
import type { GuaranteeBlockContent } from "./types";

export function GuaranteeBlock({ content }: { content: GuaranteeBlockContent }) {
  return (
    <Section tone="muted">
      <Container width="content">
        <Card cardPreset="soft-shadow" className="mx-auto max-w-xl text-center">
          {content.badgeIcon && (
            <span className="mb-3 block text-3xl" aria-hidden="true">
              {content.badgeIcon}
            </span>
          )}
          <Heading as="h3" size="h3" className="mb-2">
            {content.title}
          </Heading>
          {content.description && <Text tone="muted">{content.description}</Text>}
        </Card>
      </Container>
    </Section>
  );
}
