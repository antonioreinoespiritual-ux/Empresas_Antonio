import { notFound } from "next/navigation";
import { parsePageContent, type LandingPageContent } from "@repo/core/domain";
import { getTheme } from "@repo/ui/themes";
import { LandingRenderer } from "@repo/ui/blocks";
import { commerce } from "@/lib/commerce";

export default async function LandingBySlugPage({ params }: { params: { slug: string } }) {
  const page = await commerce.pages.findPublishedBySlug(params.slug);
  if (!page) {
    notFound();
  }

  const content = parsePageContent("LANDING", page.content) as LandingPageContent;
  const checkoutHref = `/checkout/${page.offerId}`;

  // Bloques (Fase B3): renderer moderno con el Theme real de la Offer.
  if ("blocks" in content) {
    const offer = await commerce.offers.findById(page.offerId);
    const theme = getTheme(offer?.themeId ?? "premium-light");
    return <LandingRenderer blocks={content.blocks} theme={theme} checkoutHref={checkoutHref} />;
  }

  // Forma legacy (campos sueltos, Fase A hacia atrás): renderer sin tocar,
  // para no romper ninguna página existente que todavía no usa bloques.
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
        // Contenido autorado por el admin autenticado (no por usuarios finales) — mismo
        // nivel de confianza que cualquier otro campo de copy del panel. Si en el futuro
        // se permiten múltiples admins/agencias no confiables, sanitizar antes de renderizar.
        <div className="prose mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: content.bodyHtml }} />
      )}

      <a className="mt-8 inline-block rounded bg-neutral-900 px-6 py-3 text-white" href={checkoutHref}>
        {content.ctaLabel || "Comprar ahora"}
      </a>
    </main>
  );
}
