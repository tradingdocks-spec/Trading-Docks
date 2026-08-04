import { notFound } from "next/navigation";

import { CollectorBinderExperience } from "@/components/dashboard/collector-portfolio/CollectorBinderExperience";
import { loadCollectorPortfolioForCurrentUser } from "@/lib/collector-portfolio-server";

export default async function CollectorBinderExperiencePage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;
  const data = await loadCollectorPortfolioForCurrentUser();
  const binder = data.binders.find((entry) => entry.location_id === locationId);
  if (!binder) notFound();

  return <CollectorBinderExperience profile={data.profile} binder={binder} />;
}
