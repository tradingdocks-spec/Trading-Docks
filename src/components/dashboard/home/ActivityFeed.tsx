import {
  ArrowRight,
  BadgeDollarSign,
  CircleCheck,
  PackagePlus,
  RefreshCw,
  ScanLine,
  TrendingUp,
} from "lucide-react";

const activities = [
  {
    title: "Marketplace sale completed",
    description:
      "Force of Will sold through TCGplayer for $74.95.",
    time: "2 minutes ago",
    icon: BadgeDollarSign,
    status: "Sale",
  },
  {
    title: "Inventory import completed",
    description:
      "248 Magic: The Gathering cards were added successfully.",
    time: "8 minutes ago",
    icon: PackagePlus,
    status: "Import",
  },
  {
    title: "Shopify synchronization finished",
    description:
      "932 active listings were checked and synchronized.",
    time: "14 minutes ago",
    icon: RefreshCw,
    status: "Sync",
  },
  {
    title: "Price opportunity detected",
    description:
      "Six inventory items are priced below current market value.",
    time: "22 minutes ago",
    icon: TrendingUp,
    status: "Alert",
  },
  {
    title: "Scan session processed",
    description:
      "A new batch of 76 cards is ready for condition review.",
    time: "41 minutes ago",
    icon: ScanLine,
    status: "Review",
  },
];

export function ActivityFeed() {
  return (
    <section className="rounded-[28px] border border-white/[0.085] bg-[#06121b]/82 p-5 shadow-[0_26px_85px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:p-6">
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Live operations
          </p>

          <h2 className="mt-2 text-lg font-semibold text-white">
            Recent activity
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Sales, imports, synchronizations, and market alerts.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-xs font-medium text-slate-400 transition hover:border-cyan-300/20 hover:bg-cyan-400/[0.04] hover:text-white"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-6 space-y-2">
        {activities.map((activity) => {
          const Icon = activity.icon;

          return (
            <article
              key={activity.title}
              className="group flex items-start gap-4 rounded-2xl border border-transparent px-3 py-3 transition duration-300 hover:border-white/[0.06] hover:bg-white/[0.02]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/[0.12] bg-cyan-400/[0.055] text-cyan-300 transition duration-300 group-hover:border-cyan-300/25 group-hover:bg-cyan-400/[0.1] group-hover:shadow-[0_0_24px_rgba(34,211,238,0.1)]">
                <Icon className="h-4.5 w-4.5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium text-slate-200 transition group-hover:text-white">
                    {activity.title}
                  </h3>

                  <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-600">
                    {activity.status}
                  </span>
                </div>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {activity.description}
                </p>

                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-700">
                  <CircleCheck className="h-3 w-3 text-emerald-400/70" />
                  {activity.time}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}