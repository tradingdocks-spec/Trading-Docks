"use client";

import { useState } from "react";
import { Check, Cloud, Database, Mail, ScanLine, ShieldCheck, Store, Workflow } from "lucide-react";

const integrations = [
  ["TCGplayer", "Orders and inventory"],
  ["eBay", "Listings and fulfillment"],
  ["Shopify", "Storefront catalog"],
  ["Mana Pool", "Seller API sync"],
  ["Scryfall", "Card data and imagery"],
  ["CSV", "Universal imports"],
  ["Email", "Automatic order intake"],
  ["Scanners", "Physical intake ready"],
] as const;

export function EcosystemSection() {
  const [active, setActive] = useState(3);

  return (
    <section data-td-reveal className="relative z-10 overflow-hidden border-y border-white/[0.05] bg-[#020912] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(37,99,235,.12),transparent_28%)]" />
      <div className="relative mx-auto max-w-[1380px]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Your connected commerce hub</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">Bring every channel back to one workspace.</h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-slate-500">Trading Docks sits between where cards enter your business and where they ultimately sell.</p>
        </div>

        <div className="relative mx-auto mt-16 min-h-[620px] max-w-[1100px]">
          <svg className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" viewBox="0 0 1100 620" fill="none" aria-hidden="true">
            {[
              [180, 105], [550, 72], [920, 105], [1020, 310], [920, 515], [550, 548], [180, 515], [80, 310],
            ].map(([x, y], index) => (
              <path
                key={index}
                d={`M550 310 C ${550 + (x - 550) * 0.42} ${310 + (y - 310) * 0.08}, ${550 + (x - 550) * 0.72} ${y}, ${x} ${y}`}
                stroke={index === active ? "rgba(103,232,249,.7)" : "rgba(96,165,250,.16)"}
                strokeWidth={index === active ? 2 : 1}
                strokeDasharray={index === active ? "6 8" : undefined}
              />
            ))}
          </svg>

          <div className="absolute left-1/2 top-1/2 z-10 flex h-56 w-56 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-cyan-300/[0.24] bg-[#071827] text-center shadow-[0_0_100px_rgba(37,99,235,.2),inset_0_0_40px_rgba(59,130,246,.05)]">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-600 text-[#021019] shadow-[0_15px_35px_rgba(37,99,235,.24)]">
              <Workflow className="h-6 w-6" />
            </span>
            <p className="mt-4 text-xl font-semibold text-white">Trading Docks</p>
            <p className="mt-2 max-w-[150px] text-xs leading-5 text-slate-500">One source of truth for inventory, orders, and operations.</p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/[0.14] bg-emerald-300/[0.05] px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
              <Check className="h-3 w-3" /> Connected
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:block">
            {integrations.map(([name, description], index) => {
              const positions = [
                "lg:left-[8%] lg:top-[9%]", "lg:left-1/2 lg:top-0 lg:-translate-x-1/2", "lg:right-[8%] lg:top-[9%]", "lg:right-0 lg:top-1/2 lg:-translate-y-1/2",
                "lg:right-[8%] lg:bottom-[7%]", "lg:left-1/2 lg:bottom-0 lg:-translate-x-1/2", "lg:left-[8%] lg:bottom-[7%]", "lg:left-0 lg:top-1/2 lg:-translate-y-1/2",
              ][index];
              const icons = [Store, Cloud, Store, Database, Database, Database, Mail, ScanLine];
              const Icon = icons[index];
              const selected = index === active;
              return (
                <button
                  key={name}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  className={[
                    "relative z-20 flex min-h-28 items-center gap-3 rounded-2xl border p-4 text-left transition duration-300 lg:absolute lg:w-[220px]",
                    positions,
                    selected
                      ? "border-cyan-300/[0.28] bg-blue-500/[0.12] shadow-[0_18px_55px_rgba(37,99,235,.16)]"
                      : "border-white/[0.075] bg-[#07131f] hover:border-blue-300/[0.18] hover:bg-[#081826]",
                  ].join(" ")}
                >
                  <span className={selected ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/[0.1] text-cyan-200" : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-400/[0.05] text-blue-300"}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{name}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mx-auto mt-4 flex max-w-3xl items-center justify-center gap-3 rounded-2xl border border-emerald-300/[0.12] bg-emerald-300/[0.035] px-5 py-4 text-sm text-emerald-100/75">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
          Marketplace credentials are encrypted server-side and scoped to each workspace.
        </div>
      </div>
    </section>
  );
}
