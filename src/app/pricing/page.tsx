import type { Metadata } from "next";

import { TieredPlanComparison } from "@/app/dashboard/plans/TieredPlanComparison";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Compare Trading Docks plans for collectors, online sellers, and card stores.",
};

export default function PricingPage() {
  return <TieredPlanComparison currentPlan={null} publicView />;
}
