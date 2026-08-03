"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Cloud,
  Database,
  Mail,
  ScanLine,
  ShieldCheck,
  Store,
  Workflow,
} from "lucide-react";

import styles from "./LandingMotion.module.css";

const integrations = [
  { name: "TCGplayer", description: "Orders and inventory", status: "Connected", icon: Store },
  { name: "eBay", description: "Listings and fulfillment", status: "Connected", icon: Cloud },
  { name: "Shopify", description: "Storefront catalog", status: "Available", icon: Store },
  { name: "Mana Pool", description: "Seller API synchronization", status: "Connected", icon: Database },
  { name: "Scryfall", description: "Card data and imagery", status: "Live data", icon: Database },
  { name: "CSV", description: "Universal imports", status: "Ready", icon: Database },
  { name: "Email", description: "Automatic order intake", status: "Active", icon: Mail },
  { name: "Scanners", description: "Physical intake ready", status: "Future ready", icon: ScanLine },
] as const;

export function EcosystemSection() {
  const [active, setActive] = useState(3);
  const [autoRotate, setAutoRotate] = useState(true);
  const integration = integrations[active];
  const ActiveIcon = integration.icon;

  useEffect(() => {
    if (!autoRotate) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % integrations.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [autoRotate]);

  return (
    <section
      data-td-reveal
      className="relative z-10 overflow-hidden border-y border-white/[0.05] bg-[#020912] px-5 py-24 sm:px-8 lg:px-12 lg:py-32"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_42%_50%,rgba(37,99,235,.14),transparent_30%)]" />

      <div className="relative mx-auto max-w-[1380px]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Your connected commerce hub</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
            Every channel. One source of truth.
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-slate-500">
            Select a connection to see what Trading Docks coordinates across
            inventory, orders, catalog data, and operations.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div className="relative min-h-[620px] overflow-hidden rounded-[34px] border border-blue-300/[0.15] bg-[#06131e] p-5 shadow-[0_38px_120px_rgba(0,0,0,.45)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,.17),transparent_30%)]" />

            <svg className="pointer-events-none absolute inset-0 hidden h-full w-full md:block" viewBox="0 0 760 620" fill="none" aria-hidden="true">
              {[
                [130, 95], [380, 72], [630, 95], [665, 310],
                [630, 525], [380, 548], [130, 525], [95, 310],
              ].map(([x, y], index) => (
                <path
                  key={index}
                  d={`M380 310 C ${380 + (x - 380) * 0.42} ${310 + (y - 310) * 0.08}, ${380 + (x - 380) * 0.72} ${y}, ${x} ${y}`}
                  stroke={index === active ? "rgba(103,232,249,.8)" : "rgba(96,165,250,.16)"}
                  strokeWidth={index === active ? 2 : 1}
                  className={index === active ? styles.lineFlow : undefined}
                />
              ))}
            </svg>

            <div className="absolute left-1/2 top-1/2 z-10 flex h-52 w-52 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-cyan-300/[0.26] bg-[#071827] text-center shadow-[0_0_100px_rgba(37,99,235,.22),inset_0_0_40px_rgba(59,130,246,.06)]">
              <span className={`${styles.pulseRing} absolute inset-[-16px] rounded-full border border-cyan-300/[0.16]`} />
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-600 text-[#021019] shadow-[0_15px_35px_rgba(37,99,235,.24)]">
                <Workflow className="h-6 w-6" />
              </span>
              <p className="mt-4 text-xl font-semibold text-white">Trading Docks</p>
              <p className="mt-2 max-w-[150px] text-xs leading-5 text-slate-500">Inventory, orders, and operations.</p>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/[0.14] bg-emerald-300/[0.05] px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                <Check className="h-3 w-3" /> Connected
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:block">
              {integrations.map((item, index) => {
                const positions = [
                  "md:left-[5%] md:top-[8%]",
                  "md:left-1/2 md:top-[4%] md:-translate-x-1/2",
                  "md:right-[5%] md:top-[8%]",
                  "md:right-[2%] md:top-1/2 md:-translate-y-1/2",
                  "md:right-[5%] md:bottom-[8%]",
                  "md:left-1/2 md:bottom-[4%] md:-translate-x-1/2",
                  "md:left-[5%] md:bottom-[8%]",
                  "md:left-[2%] md:top-1/2 md:-translate-y-1/2",
                ][index];
                const Icon = item.icon;
                const selected = index === active;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onMouseEnter={() => {
                      setAutoRotate(false);
                      setActive(index);
                    }}
                    onFocus={() => {
                      setAutoRotate(false);
                      setActive(index);
                    }}
                    onClick={() => {
                      setAutoRotate(false);
                      setActive(index);
                    }}
                    className={[
                      "relative z-20 flex min-h-[92px] items-center gap-3 rounded-2xl border p-3.5 text-left transition duration-300 md:absolute md:w-[188px]",
                      positions,
                      selected
                        ? "border-cyan-300/[0.30] bg-blue-500/[0.14] shadow-[0_18px_55px_rgba(37,99,235,.17)]"
                        : "border-white/[0.075] bg-[#07131f] hover:border-blue-300/[0.18] hover:bg-[#081826]",
                    ].join(" ")}
                  >
                    <span className={selected ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/[0.1] text-cyan-200" : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-400/[0.05] text-blue-300"}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{item.name}</span>
                      <span className="mt-1 block truncate text-xs text-slate-600">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            key={integration.name}
            className={`${styles.previewSwap} rounded-[30px] border border-cyan-300/[0.17] bg-gradient-to-br from-[#0a1c2b] to-[#06121d] p-6 shadow-[0_34px_100px_rgba(0,0,0,.38)]`}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/[0.18] bg-cyan-300/[0.08] text-cyan-200">
                <ActiveIcon className="h-5 w-5" />
              </span>
              <span className="rounded-full border border-emerald-300/[0.13] bg-emerald-300/[0.05] px-3 py-1.5 text-xs font-semibold text-emerald-300">
                {integration.status}
              </span>
            </div>

            <p className="mt-7 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Active connection</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">{integration.name}</h3>
            <p className="mt-4 text-sm leading-7 text-slate-400">{integration.description}</p>

            <div className="mt-7 space-y-3">
              {[
                "Workspace-scoped credentials",
                "Duplicate-safe synchronization",
                "Preview before inventory changes",
              ].map((feature, index) => (
                <div
                  key={feature}
                  className={`${styles.activitySlide} flex items-center gap-3 rounded-2xl border border-white/[0.065] bg-black/[0.12] px-4 py-3`}
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-300/[0.07] text-emerald-300">
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="text-sm text-slate-300">{feature}</span>
                </div>
              ))}
            </div>

            <div className="mt-7 flex items-center gap-3 rounded-2xl border border-emerald-300/[0.12] bg-emerald-300/[0.035] px-4 py-4 text-sm text-emerald-100/75">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
              Credentials are encrypted server-side and isolated by workspace.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
