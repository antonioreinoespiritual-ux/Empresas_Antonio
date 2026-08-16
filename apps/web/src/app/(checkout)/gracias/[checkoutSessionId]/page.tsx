import { getTheme } from "@repo/ui/themes";
import { ThemeProvider, Section, Container, Heading, Text, VIDEO_IFRAME_SANDBOX } from "@repo/ui/primitives";
import { DEFAULT_THEME_ID } from "@repo/core/domain";
import { commerce } from "@/lib/commerce";
import { OrderStatus } from "./order-status";

interface ThankYouContent {
  title?: string;
  message?: string;
  videoUrl?: string;
}

const DEFAULT_TITLE = "¡Gracias por tu compra!";
const DEFAULT_MESSAGE =
  "Esta página solo lee el estado de tu pedido — la confirmación real llega por webhook, nunca desde el navegador.";

export default async function ThankYouPage({ params }: { params: { checkoutSessionId: string } }) {
  const checkoutSession = await commerce.checkoutSessions.findById(params.checkoutSessionId);
  const [page, offer] = checkoutSession
    ? await Promise.all([
        commerce.pages.findByOfferAndKind(checkoutSession.offerId, "THANK_YOU"),
        commerce.offers.findById(checkoutSession.offerId),
      ])
    : [null, null];
  const content = page?.status === "PUBLISHED" ? (page.content as ThankYouContent) : null;
  // Si la CheckoutSession o la Offer ya no existen, seguimos mostrando la
  // confirmación genérica en vez de un error — nunca dejar a un comprador que
  // ya pagó viendo una pantalla rota.
  const theme = getTheme(offer?.themeId ?? DEFAULT_THEME_ID);

  return (
    <ThemeProvider theme={theme}>
      <Section tone="base" className="min-h-screen">
        <Container width="content">
          <Heading as="h1">{content?.title || DEFAULT_TITLE}</Heading>
          <Text className="mt-4">{content?.message || DEFAULT_MESSAGE}</Text>

          {content?.videoUrl && (
            <div className="mt-8 aspect-video w-full overflow-hidden rounded-base">
              <iframe
                className="h-full w-full"
                src={content.videoUrl}
                title="Video"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                sandbox={VIDEO_IFRAME_SANDBOX}
              />
            </div>
          )}

          <OrderStatus checkoutSessionId={params.checkoutSessionId} />
        </Container>
      </Section>
    </ThemeProvider>
  );
}
