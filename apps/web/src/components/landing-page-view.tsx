import { parsePageContent, type LandingPageContent, type Page } from "@repo/core/domain";
import { getTheme } from "@repo/ui/themes";
import { LandingRenderer } from "@repo/ui/blocks";
import { CompositionRenderer } from "@repo/ui/composition";
import { commerce } from "@/lib/commerce";

// Extraído de (marketing)/[slug]/page.tsx para que /preview/[token] (F5)
// reuse exactamente el mismo motor de render, sin importar el status de la
// Page (a diferencia de /[slug], que solo sirve PUBLISHED) — "reutiliza el
// motor de render de /[slug] sin importar el estado de la página",
// PLAN-AGENT-API-01.
export async function LandingPageView({ page }: { page: Page }) {
  const content = parsePageContent("LANDING", page.content) as LandingPageContent;
  const checkoutHref = `/checkout/${page.offerId}`;

  if ("blocks" in content) {
    const offer = await commerce.offers.findById(page.offerId);
    const theme = getTheme(offer?.themeId ?? "premium-light");
    return <LandingRenderer blocks={content.blocks} theme={theme} checkoutHref={checkoutHref} />;
  }

  if ("version" in content) {
    const offer = await commerce.offers.findById(page.offerId);
    const theme = getTheme(offer?.themeId ?? "premium-light");
    return <CompositionRenderer composition={content} theme={theme} checkoutHref={checkoutHref} />;
  }

  return (
    <main className="py-16">
      <h1 className="text-4xl font-bold">{content.heroTitle}</h1>
      {content.heroSubtitle && <p className="mt-4 text-lg text-neutral-600">{content.heroSubtitle}</p>}

      {content.vslEmbedUrl && (
        <div className="mt-8 aspect-video w-full overflow-hidden rounded">
          <iframe
            className="h-full w-full"
            src={content.vslEmbedUrl}
            title="Video"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {content.bodyHtml && (
        <div className="prose mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: content.bodyHtml }} />
      )}

      <a className="mt-8 inline-block rounded bg-neutral-900 px-6 py-3 text-white" href={checkoutHref}>
        {content.ctaLabel || "Comprar ahora"}
      </a>
    </main>
  );
}
