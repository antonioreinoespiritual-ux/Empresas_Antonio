import { parsePageContent, type LandingPageContent, type Page } from "@repo/core/domain";
import { getTheme } from "@repo/ui/themes";
import { LandingRenderer } from "@repo/ui/blocks";
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
    // Composition (ARCH-LANDING-EDITOR-02) todavía no tiene renderer — nada
    // hoy puede crear una Page con este formato por ninguna vía real (Fase 1
    // es solo dominio), así que esta rama es inalcanzable en la práctica.
    // Se deja explícita en vez de dejar que TypeScript la descarte del todo:
    // si algo cambiara eso antes de que exista CompositionRenderer (Fase 2),
    // falla acá con un mensaje claro, no con un acceso a un campo legacy
    // inexistente más abajo.
    throw new Error("Composition (composition-1) todavía no tiene renderer — pendiente de Fase 2");
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
