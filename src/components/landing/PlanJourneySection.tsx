import {
  ArrowRight,
  BarChart3,
  Building2,
  Layers3,
  PackageSearch,
} from "lucide-react";

const stages = [
  {
    number: "01",
    name: "Free",
    audience: "Start organizing",
    description:
      "Create a personal workspace with Inventory and Deck Vault.",
    detail: "500 inventory units · 10 decks",
    icon: Layers3,
  },
  {
    number: "02",
    name: "Collector",
    audience: "Understand your collection",
    description:
      "Add collection analytics, value history, and CSV workflows.",
    detail: "10,000 inventory units · 50 decks",
    icon: BarChart3,
  },
  {
    number: "03",
    name: "Seller",
    audience: "Run an online card business",
    description:
      "Unlock purchasing, CRM, marketplaces, orders, and automation.",
    detail: "50,000 inventory units · Unlimited decks",
    icon: PackageSearch,
  },
  {
    number: "04",
    name: "Store",
    audience: "Operate a full storefront",
    description:
      "Add business intelligence, staff, vendors, tournaments, and payroll.",
    detail: "250,000 inventory units · 5 seats",
    icon: Building2,
  },
];

export function PlanJourneySection() {
  return (
    <section
      id="plans"
      className="relative z-10 overflow-hidden border-y border-white/[0.05] bg-[#030b14]"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-18rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-blue-500/[0.08] blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(100,150,220,.022)_1px,transparent_1px),linear-gradient(90deg,rgba(100,150,220,.022)_1px,transparent_1px)] bg-[size:52px_52px]" />
      </div>

      <div className="relative mx-auto max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              One product, four clear stages
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
              Your workspace grows with you.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-500">
              Each plan adds a focused layer of capability. You keep the same
              data, the same workspace, and the same operating system.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-blue-300/[0.12] bg-blue-400/[0.035] px-4 py-3 text-sm text-blue-100/80">
            <ArrowRight className="h-4 w-4 shrink-0 text-cyan-300" />
            Start on Free and move up only when the next workflow becomes
            useful.
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stages.map(({ number, name, audience, description, detail, icon: Icon }, index) => (
            <article
              key={name}
              className="group relative min-h-[330px] overflow-hidden rounded-[26px] border border-white/[0.075] bg-[#07121f]/90 p-5 shadow-[0_22px_70px_rgba(0,0,0,.24)] transition duration-300 hover:-translate-y-1 hover:border-blue-300/[0.18]"
            >
              <div className="absolute right-5 top-4 text-5xl font-semibold tracking-[-0.06em] text-white/[0.035]">
                {number}
              </div>

              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-300/[0.14] bg-blue-400/[0.055] text-blue-300">
                <Icon className="h-5 w-5" />
              </span>

              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                {audience}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
                {name}
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-400">
                {description}
              </p>

              <div className="absolute inset-x-5 bottom-5 border-t border-white/[0.06] pt-4">
                <p className="text-xs font-medium text-blue-200/75">{detail}</p>
              </div>

              {index < stages.length - 1 ? (
                <span className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-blue-300/[0.16] bg-[#07121f] text-blue-300 xl:flex">
                  <ArrowRight className="h-3 w-3" />
                </span>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
