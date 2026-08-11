import { notFound } from "next/navigation";
import { LandingPageView } from "@/components/landing-page-view";
import { commerce } from "@/lib/commerce";

// Sin esto, Next.js trata esta ruta dinámica sin generateStaticParams como
// estática-en-la-primera-visita: cachea el HTML (o el 404 de notFound()) de
// cada slug indefinidamente hasta el próximo deploy de apps/web. Un agente
// publica una Page nueva y el primer visitante la cachea rota; Antonio
// publicó/editó una Page real, visitó su slug y encontró el 404 cacheado de
// esa primera visita — confirmado en producción real (F9).
export const dynamic = "force-dynamic";

export default async function LandingBySlugPage({ params }: { params: { slug: string } }) {
  const page = await commerce.pages.findPublishedBySlug(params.slug);
  if (!page) {
    notFound();
  }

  return <LandingPageView page={page} />;
}
