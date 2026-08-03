"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CircleDollarSign,
  PackageCheck,
  ScanLine,
  ShoppingCart,
  Tags,
} from "lucide-react";

const steps = [
  { label: "Acquire", text: "Evaluate collections and buying opportunities.", icon: CircleDollarSign },
  { label: "Scan", text: "Identify cards and exact printings from photos.", icon: ScanLine },
  { label: "Organize", text: "File every item into searchable inventory.", icon: Boxes },
  { label: "Price", text: "Compare markets and apply buying or selling rules.", icon: Tags },
  { label: "List", text: "Publish inventory across connected channels.", icon: ShoppingCart },
  { label: "Fulfill", text: "Route orders into one pick, pack, and ship queue.", icon: PackageCheck },
  { label: "Analyze", text: "Measure profit, sell-through, and collection growth.", icon: BarChart3 },
];

export function WorkflowExperienceSection() {
  const ref = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let timer: number | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || timer !== null) return;
        timer = window.setInterval(() => {
          setActive((current) => (current + 1) % steps.length);
        }, 1450);
        observer.disconnect();
      },
      { threshold: 0.25 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      if (timer !== null) window.clearInterval(timer);
    };
  }, []);

  return (
    <section ref={ref} data-td-reveal className="relative z-10 overflow-hidden bg-[#030b13] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
      <div className="mx-auto max-w-[1480px]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">The complete card lifecycle</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">From acquisition to insight. One connected flow.</h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-slate-500">Trading Docks replaces disconnected spreadsheets, inboxes, and dashboards with one traceable operating system.</p>
        </div>

        <div className="relative mt-14 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <div className="pointer-events-none absolute left-[7%] right-[7%] top-10 hidden h-px bg-gradient-to-r from-transparent via-blue-300/[0.22] to-transparent xl:block" />
          {steps.map(({ label, text, icon: Icon }, index) => {
            const selected = index === active;
            return (
              <button
                key={label}
                type="button"
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                className={[
                  "group relative min-h-[220px] overflow-hidden rounded-[24px] border p-5 text-left transition duration-500",
                  selected
                    ? "-translate-y-2 border-cyan-300/[0.28] bg-gradient-to-b from-blue-500/[0.14] to-[#07131f] shadow-[0_24px_80px_rgba(37,99,235,.16)]"
                    : "border-white/[0.07] bg-[#07121d] hover:-translate-y-1 hover:border-blue-300/[0.17]",
                ].join(" ")}
              >
                <span className={[
                  "relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border transition",
                  selected ? "border-cyan-200/[0.25] bg-cyan-200/[0.1] text-cyan-200" : "border-blue-300/[0.12] bg-blue-400/[0.045] text-blue-300",
                ].join(" ")}>
                  <Icon className="h-5 w-5" />
                </span>
                <p className="relative z-10 mt-6 text-lg font-semibold text-white">{label}</p>
                <p className="relative z-10 mt-3 text-sm leading-6 text-slate-500">{text}</p>
                <span className="absolute right-4 top-4 text-4xl font-semibold text-white/[0.035]">0{index + 1}</span>
                {selected ? <span className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-300" /> : null}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs font-medium text-slate-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
          Hover any stage to explore the workflow
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </section>
  );
}
