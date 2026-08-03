import {
  BarChart3,
  Building2,
  Network,
  PackageSearch,
  ShoppingCart,
  Users,
} from "lucide-react";

const capabilities = [
  {
    title: "Inventory and Deck Vault",
    description:
      "Organize singles, sealed products, graded cards, decks, and exact storage locations.",
    plan: "Free",
    icon: PackageSearch,
  },
  {
    title: "Collection analytics",
    description:
      "Track value, growth, and collection history with richer CSV workflows.",
    plan: "Collector",
    icon: BarChart3,
  },
  {
    title: "Purchasing and CRM",
    description:
      "Evaluate acquisitions, manage customers, loyalty, store credit, and buying rules.",
    plan: "Seller",
    icon: Users,
  },
  {
    title: "Marketplaces and orders",
    description:
      "Connect sales channels, import orders, and manage fulfillment in one workspace.",
    plan: "Seller",
    icon: Network,
  },
  {
    title: "Card Shows and automation",
    description:
      "Support seller events, repetitive workflows, and operational review queues.",
    plan: "Seller",
    icon: ShoppingCart,
  },
  {
    title: "Store operations",
    description:
      "Run business intelligence, tasks, staff, vendors, tournaments, payroll, and finances.",
    plan: "Store",
    icon: Building2,
  },
];

export function FeaturesSection() {
  return (
    <section
      id="platform"
      className="relative z-10 border-y border-white/[0.05] bg-white/[0.012]"
    >
      <div className="mx-auto w-full max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Permission-aware by design
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            Every feature appears when it becomes useful.
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-slate-500">
            Free and Collector stay focused on personal collection management.
            Seller adds commerce. Store adds the operational layer for a team.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {capabilities.map(({ title, description, plan, icon: Icon }) => (
            <article
              key={title}
              className="group relative min-h-[255px] overflow-hidden rounded-[25px] border border-white/[0.075] bg-[#071522]/80 p-5 shadow-[0_24px_75px_rgba(0,0,0,0.24)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-cyan-300/[0.18] hover:bg-[#081927]"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/[0.16] bg-cyan-300/[0.055] text-cyan-200 shadow-[0_0_28px_rgba(0,215,242,0.08)]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="rounded-full border border-blue-300/[0.12] bg-blue-400/[0.04] px-2.5 py-1 text-[11px] font-semibold text-blue-200/80">
                  {plan}+
                </span>
              </div>

              <h3 className="mt-6 text-lg font-semibold tracking-[-0.02em] text-white">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                {description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
