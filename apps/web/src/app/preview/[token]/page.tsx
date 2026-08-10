import { notFound } from "next/navigation";
import { verifyPreviewToken } from "@repo/core/application";
import { LandingPageView } from "@/components/landing-page-view";
import { commerce } from "@/lib/commerce";

// F5 (PLAN-AGENT-API-01): reutiliza el mismo motor de render que /[slug],
// sin importar el status de la Page (DRAFT o PUBLISHED) — a diferencia de
// /[slug], que solo sirve Pages PUBLISHED por slug. Los headers de
// no-index/no-cache/no-referrer se fijan en middleware.ts (necesitan ser
// headers HTTP reales, no meta tags — un page.tsx de App Router no puede
// setearlos directamente).
export default async function PreviewPage({ params }: { params: { token: string } }) {
  const result = await verifyPreviewToken(
    { previewTokens: commerce.previewTokens, pages: commerce.pages, hasher: commerce.previewTokenHasher },
    params.token,
    new Date()
  );

  if (!result.ok) {
    notFound();
  }

  return <LandingPageView page={result.page} />;
}
