"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Layers3,
  Link2,
  Store,
} from "lucide-react";

const marketplaces = [
  {
    name: "TCGplayer",
    games: "Magic · Pokémon · Lorcana",
    detail: "Listings, inventory quantities, orders, and pricing workflows.",
    state: "Available",
  },
  {
    name: "eBay",
    games: "All supported collectibles",
    detail: "Listings, orders, fulfillment, and payout reconciliation.",
    state: "Available",
  },
  {
    name: "Shopify",
    games: "Storefront catalog",
    detail: "Store inventory, online orders, and product synchronization.",
    state: "Available",
  },
  {
    name: "Mana Pool",
    games: "Magic: The Gathering",
    detail: "Inventory, listings, sales, and marketplace pricing.",
    state: "Setup planned",
  },
  {
    name: "CardSphere",
    games: "Magic: The Gathering",
    detail: "Collection availability, wants, sends, and account activity.",
    state: "Integration candidate",
  },
  {
    name: "CardTrader",
    games: "Magic · Pokémon · other TCGs",
    detail: "International catalog, listings, orders, and CardTrader Zero workflows.",
    state: "Integration candidate",
  },
  {
    name: "Misprint",
    games: "Pokémon",
    detail: "Specialty Pokémon misprint inventory and listing workflows.",
    state: "Integration candidate",
  },
] as const;

export function MarketplaceWorkspace() {
  return (
    <div className="mx-auto w-full max-w-[1640px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="rounded-[28px] border border-cyan-300/15 bg-[#06131d]/90 p-6 shadow-[0_30px_90px_rgba(0,0,0,.3)] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-300">
              Marketplace workspace
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Sales channel integrations
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Connect channels to synchronize eligible inventory, listings, orders,
              and marketplace activity from one workspace.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-xs text-slate-300">
            <Layers3 className="h-4 w-4 text-cyan-300" />
            7 supported or planned channels
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {marketplaces.map((marketplace) => {
          const available = marketplace.state === "Available";
          return (
            <article
              key={marketplace.name}
              className="rounded-[22px] border border-white/[.08] bg-[#07141e]/90 p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/20"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-400/[.06]">
                  <Store className="h-5 w-5 text-cyan-300" />
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider ${
                  available
                    ? "border-emerald-300/20 bg-emerald-400/[.06] text-emerald-300"
                    : "border-amber-300/20 bg-amber-400/[.05] text-amber-200"
                }`}>
                  {available ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                  {marketplace.state}
                </span>
              </div>
              <h2 className="mt-5 text-lg font-semibold text-white">{marketplace.name}</h2>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-cyan-300/80">
                {marketplace.games}
              </p>
              <p className="mt-3 min-h-12 text-xs leading-5 text-slate-500">
                {marketplace.detail}
              </p>
              <button
                type="button"
                className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-400/[.045] text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/30 hover:bg-cyan-400/[.08]"
              >
                {available ? <Link2 className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                {available ? "Configure connection" : "View integration plan"}
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}
