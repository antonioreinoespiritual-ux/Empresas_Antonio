import { notFound } from "next/navigation";
import { getTheme } from "@repo/ui/themes";
import { ThemeProvider, Section, Container, Heading, Text } from "@repo/ui/primitives";
import { commerce } from "@/lib/commerce";
import { CheckoutForm } from "./checkout-form";

interface CheckoutContent {
  headline?: string;
  subheadline?: string;
}

// El checkout comparte el Theme de la Offer (mismo selector del admin que ya
// pinta la landing) — es la misma Offer, así que es el mismo tema, sin campo
// nuevo que mantener sincronizado. El flujo de pago (CheckoutForm, acciones,
// providers) no se toca: solo cambia el envoltorio visual de esta página.
export default async function CheckoutPage({ params }: { params: { offerId: string } }) {
  const offer = await commerce.offers.findById(params.offerId);
  if (!offer) {
    notFound();
  }

  const page = await commerce.pages.findByOfferAndKind(offer.id, "CHECKOUT");
  const content = page?.status === "PUBLISHED" ? (page.content as CheckoutContent) : null;
  const theme = getTheme(offer.themeId);

  return (
    <ThemeProvider theme={theme}>
      <Section tone="base" className="min-h-screen">
        <Container width="content">
          <Heading as="h1">{content?.headline || offer.name}</Heading>
          {content?.subheadline && <Text className="mt-2">{content.subheadline}</Text>}
          <CheckoutForm offerId={offer.id} prices={offer.prices} buttonPreset={theme.buttonPreset} />
        </Container>
      </Section>
    </ThemeProvider>
  );
}
