import type { Theme } from "../themes/types";
import { Card, Container, Grid, Heading, Section, Stack, Text } from "../primitives";
import type { TestimonialsBlockContent } from "./types";

export function TestimonialsBlock({ content, theme }: { content: TestimonialsBlockContent; theme: Theme }) {
  return (
    <Section tone="muted">
      <Container width="wide">
        {content.heading && (
          <Heading as="h2" className="mb-10 text-center">
            {content.heading}
          </Heading>
        )}
        <Grid columns={3} gap="md">
          {content.items.map((item, index) => (
            <Card key={index} cardPreset={theme.cardPreset === "editorial-divider" ? "flat-border" : theme.cardPreset}>
              <Text size="md" className="mb-4">
                “{item.quote}”
              </Text>
              <Stack direction="row" gap="sm" align="center">
                {item.avatarUrl && <img src={item.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />}
                <div>
                  <Text size="sm" weight="semibold">
                    {item.authorName}
                  </Text>
                  {item.authorRole && (
                    <Text size="sm" tone="muted">
                      {item.authorRole}
                    </Text>
                  )}
                </div>
              </Stack>
            </Card>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
