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
  const page = checkoutSession
    ? await commerce.pages.findByOfferAndKind(checkoutSession.offerId, "THANK_YOU")
    : null;
  const content = page?.status === "PUBLISHED" ? (page.content as ThankYouContent) : null;

  return (
    <main className="py-16">
      <h1 className="text-2xl font-semibold">{content?.title || DEFAULT_TITLE}</h1>
      <p className="mt-4 text-neutral-600">{content?.message || DEFAULT_MESSAGE}</p>

      {content?.videoUrl && (
        <div className="mt-8 aspect-video w-full overflow-hidden rounded">
          <iframe
            className="h-full w-full"
            src={content.videoUrl}
            title="Video"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      <OrderStatus checkoutSessionId={params.checkoutSessionId} />
    </main>
  );
}
