import { CollectorPortfolioWorkspace } from "@/components/dashboard/collector-portfolio/CollectorPortfolioWorkspace";
import { loadCollectorPortfolioForCurrentUser } from "@/lib/collector-portfolio-server";

export default async function CollectorPortfolioPage() {
  const data = await loadCollectorPortfolioForCurrentUser();
  return <CollectorPortfolioWorkspace initialData={data} />;
}
