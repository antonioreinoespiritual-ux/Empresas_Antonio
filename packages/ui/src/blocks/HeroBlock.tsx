import type { Theme } from "../themes/types";
import { Button, Container, Heading, Section, Stack, Text } from "../primitives";
import type { HeroBlockContent } from "./types";

export function HeroBlock({ content, checkoutHref, theme }: { content: HeroBlockContent; checkoutHref: string; theme: Theme }) {
  const hasBackground = Boolean(content.backgroundImageUrl);
  return (
    <Section
      tone="base"
      className="relative overflow-hidden"
      style={
        hasBackground
          ? { backgroundImage: `url(${content.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
          : undefined
      }
    >
      {/* Overlay funcional para legibilidad del texto sobre la imagen, no
          decorativo — rgba fija en vez de un token de opacidad: los tokens
          de color del theme guardan hex completo, no canales rgb, así que
          un modificador de opacidad de Tailwind (bg-foreground/60)
          generaría CSS inválido (ver Badge). */}
      {hasBackground && <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.55)" }} aria-hidden="true" />}
      <Container width="content" className="relative text-center">
        <Stack gap="lg" align="center">
          <Heading as="h1" className={hasBackground ? "text-background" : undefined}>
            {content.title}
          </Heading>
          {content.subtitle && (
            <Text size="lg" className={hasBackground ? "mx-auto text-background" : "mx-auto"}>
              {content.subtitle}
            </Text>
          )}
          <a href={checkoutHref}>
            <Button variant="primary" size="lg" buttonPreset={theme.buttonPreset}>
              {content.ctaLabel}
            </Button>
          </a>
        </Stack>
      </Container>
    </Section>
  );
}
