import type { Theme } from "../themes/types";
import { Card, Container, Grid, Heading, Section, Text } from "../primitives";
import type { BenefitsBlockContent } from "./types";

export function BenefitsBlock({ content, theme }: { content: BenefitsBlockContent; theme: Theme }) {
  return (
    <Section tone="base">
      <Container width="wide">
        {content.heading && (
          <Heading as="h2" className="mb-10 text-center">
            {content.heading}
          </Heading>
        )}
        <Grid columns={3} gap="md">
          {content.items.map((item, index) => (
            <Card key={index} cardPreset={theme.cardPreset}>
              {item.icon && (
                <span className="mb-3 block text-2xl" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              <Heading as="h4" size="h4" className="mb-2">
                {item.title}
              </Heading>
              {item.description && (
                <Text size="sm" tone="muted">
                  {item.description}
                </Text>
              )}
            </Card>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
