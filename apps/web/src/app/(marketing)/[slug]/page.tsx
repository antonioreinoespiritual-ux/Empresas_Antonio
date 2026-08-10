import { notFound } from "next/navigation";
import { LandingPageView } from "@/components/landing-page-view";
import { commerce } from "@/lib/commerce";

export default async function LandingBySlugPage({ params }: { params: { slug: string } }) {
  const page = await commerce.pages.findPublishedBySlug(params.slug);
  if (!page) {
    notFound();
  }

  return <LandingPageView page={page} />;
}
