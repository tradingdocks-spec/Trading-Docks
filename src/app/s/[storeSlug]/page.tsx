import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShowcasePublicExperience } from "@/components/showcase/ShowcasePublicExperience";
import { getShowcase } from "@/lib/showcase";
import { LegacyStorefrontReadOnly } from "@/components/storefront/LegacyStorefrontReadOnly";

export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string }> }): Promise<Metadata> {
  const { storeSlug } = await params;
  if (process.env.STOREFRONT_READ_MODE === "legacy") return { title: "Store catalog · Trading Docks" };
  const showcase = await getShowcase(storeSlug);
  if (!showcase) return { title: "Showcase unavailable · Trading Docks" };
  return { title: `${showcase.profile.display_name} · Storefront`, description: showcase.profile.description ?? `Browse ${showcase.profile.display_name}'s listed card inventory.` };
}

export default async function PublicShowcasePage({ params, searchParams }: { params: Promise<{ storeSlug: string }>; searchParams: Promise<{ q?: string }> }) {
  const { storeSlug } = await params;
  const { q = "" } = await searchParams;
  if (process.env.STOREFRONT_READ_MODE === "legacy") return <LegacyStorefrontReadOnly slug={storeSlug} query={q} />;
  const showcase = await getShowcase(storeSlug, q);
  if (!showcase) notFound();
  return <ShowcasePublicExperience slug={storeSlug} profile={showcase.profile} cards={showcase.cards} initialQuery={q} />;
}
