import { DashboardHeader } from "@/components/dashboard/home/DashboardHeader";
import { MetricGrid } from "@/components/dashboard/home/MetricGrid";
import { MarketplaceHealth } from "@/components/dashboard/panels/MarketplaceHealth";
import { RevenueOverview } from "@/components/dashboard/panels/RevenueOverview";

export default function DashboardPage() {
  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[12%] top-10 h-72 w-72 rounded-full bg-cyan-400/[0.035] blur-[120px]" />
        <div className="absolute right-[8%] top-40 h-72 w-72 rounded-full bg-violet-500/[0.025] blur-[120px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1600px] flex-col gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <DashboardHeader />

        <MetricGrid />

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.85fr)]">
          <RevenueOverview />
          <MarketplaceHealth />
        </section>
      </div>
    </div>
  );
}