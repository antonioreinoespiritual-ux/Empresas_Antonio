import { THEME_PRESETS } from "@repo/ui/themes";
import { Badge, Button, Card, Container, Divider, FormField, Heading, Section, Stack, Text, ThemeProvider } from "@repo/ui/primitives";

// Ruta interna de verificación visual para Frontend System v1 (B1). No está
// enlazada desde ningún nav — se borra o se protege antes de ir a producción
// final, sirve solo para validar tokens + primitivas contra los 4 presets.
export default function DesignSystemPage() {
  return (
    <main className="bg-white py-12">
      <Container width="wide">
        <h1 className="mb-8 text-2xl font-bold">Design System — verificación B1</h1>
        <Stack gap="xl">
          {Object.values(THEME_PRESETS).map((theme) => (
            <ThemeProvider key={theme.id} theme={theme} className="rounded-lg border border-neutral-200">
              <Section tone="base" className="rounded-t-lg">
                <Container>
                  <Text tone="muted" size="sm" weight="semibold" className="mb-2 uppercase tracking-wide">
                    {theme.name}
                  </Text>
                  <Heading as="h1" className="mb-4">
                    Despierta el propósito que ya vive en ti
                  </Heading>
                  <Text tone="muted" size="lg" className="mb-6">
                    Un acompañamiento personal de 8 semanas para reconectar con tu camino espiritual.
                  </Text>
                  <Stack direction="row" gap="sm" className="mb-6">
                    <Button variant="primary" buttonPreset={theme.buttonPreset}>
                      Reservar mi cupo
                    </Button>
                    <Button variant="secondary">Ver testimonios</Button>
                    <Button variant="ghost">Cancelar</Button>
                  </Stack>
                  <Stack direction="row" gap="sm" className="mb-8">
                    <Badge tone="success">✓ Garantía de 14 días</Badge>
                    <Badge tone="accent">Nuevo</Badge>
                    <Badge tone="neutral">Cupos limitados</Badge>
                  </Stack>
                  <Divider className="mb-8" />
                  <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Card cardPreset={theme.cardPreset}>
                      <Heading as="h4" size="h4" className="mb-2">
                        Acompañamiento semanal
                      </Heading>
                      <Text tone="muted" size="sm">
                        Sesión en vivo + seguimiento por mensaje toda la semana.
                      </Text>
                    </Card>
                    <Card cardPreset={theme.cardPreset}>
                      <Heading as="h4" size="h4" className="mb-2">
                        Comunidad privada
                      </Heading>
                      <Text tone="muted" size="sm">
                        Acceso al grupo de acompañamiento entre sesiones.
                      </Text>
                    </Card>
                  </div>
                  <FormField label="Correo electrónico" placeholder="tucorreo@ejemplo.com" name="email" />
                </Container>
              </Section>
              <Section tone="inverted" className="rounded-b-lg">
                <Container>
                  <Heading as="h2" className="mb-3">
                    Cierre de alto contraste
                  </Heading>
                  <Text className="mb-4" style={{ color: "inherit" }}>
                    Bloque CTA de cierre — fondo invertido para bookend de la página.
                  </Text>
                  {/* Regla del bloque CTA de cierre: siempre "solid", nunca el
                      buttonPreset del theme. "outline-accent" (Editorial) es
                      ilegible sobre un fondo ya invertido — el propósito de
                      este bloque es máximo contraste, no consistencia de preset. */}
                  <Button variant="primary" buttonPreset="solid">
                    Reservar mi cupo ahora
                  </Button>
                </Container>
              </Section>
            </ThemeProvider>
          ))}
        </Stack>
      </Container>
    </main>
  );
}
