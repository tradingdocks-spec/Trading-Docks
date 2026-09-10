import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShowcasePublicExperience } from "@/components/showcase/ShowcasePublicExperience";
import { getShowcase } from "@/lib/showcase";

export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string }> }): Promise<Metadata> {
  const { storeSlug } = await params;
  const showcase = await getShowcase(storeSlug);
  if (!showcase) return { title: "Showcase unavailable · Trading Docks" };
  return { title: `${showcase.profile.display_name} · Showcase`, description: showcase.profile.description ?? `Browse ${showcase.profile.display_name}'s live card inventory.` };
}

export default async function PublicShowcasePage({ params, searchParams }: { params: Promise<{ storeSlug: string }>; searchParams: Promise<{ q?: string }> }) {
  const { storeSlug } = await params;
  const { q = "" } = await searchParams;
  const showcase = await getShowcase(storeSlug, q);
  if (!showcase) notFound();
  return <ShowcasePublicExperience slug={storeSlug} profile={showcase.profile} cards={showcase.cards} initialQuery={q} />;
}
