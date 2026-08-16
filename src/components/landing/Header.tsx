"use client";

import {
  ArrowRight,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { TransitionLink } from "@/components/navigation/PolishedNavigation";
import { BrandMark } from "./BrandMark";
import styles from "./SignatureHero.module.css";

const PRODUCT_NAV = [
  { label: "Lifecycle", href: "#experience" },
  { label: "Platform", href: "#platform" },
  { label: "Market", href: "#market" },
  { label: "Pricing", href: "#pricing" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#02090f]/96 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] w-full max-w-[1480px] items-center justify-between px-4 sm:px-8 lg:px-12">
        <BrandMark priority />

        <nav className="hidden items-center gap-1 lg:flex">
          {PRODUCT_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-200"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <TransitionLink
            href="/sign-in"
            className="inline-flex h-10 shrink-0 items-center px-4 text-sm font-medium text-slate-400 transition hover:text-white"
          >
            Log in
          </TransitionLink>
          <TransitionLink
            href="/sign-up"
            className={`${styles.primaryButton} group inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] bg-cyan-300 px-4 text-sm font-semibold text-[#01131a] transition hover:bg-cyan-200`}
          >
            <span className="relative z-10">Get started</span>
            <ArrowRight className="relative z-10 h-4 w-4" />
          </TransitionLink>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? "Close navigation" : "Open navigation"}
          className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-white/[0.1] text-slate-200 transition active:scale-95 sm:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-x-0 top-[68px] z-50 h-[calc(100dvh-68px)] border-t border-white/[0.06] bg-[#020912]/[0.98] px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl sm:hidden">
          <nav className="mx-auto flex max-w-md flex-col gap-2">
            {PRODUCT_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex min-h-[52px] items-center justify-between border-b border-white/[0.08] px-1 text-base font-semibold text-slate-200 last:border-b-0"
              >
                {item.label}
                <ArrowRight className="h-4 w-4 text-blue-300" />
              </a>
            ))}
          </nav>

          <div className="mx-auto mt-4 grid max-w-md grid-cols-2 gap-3">
            <TransitionLink
              href="/sign-in"
              className="inline-flex h-[48px] items-center justify-center rounded-[10px] border border-white/[0.1] text-sm font-semibold text-white"
            >
              Log in
            </TransitionLink>
            <TransitionLink
              href="/sign-up"
              className="inline-flex h-[48px] items-center justify-center gap-2 rounded-[10px] bg-cyan-300 text-sm font-semibold text-[#01131a]"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </TransitionLink>
          </div>
        </div>
      ) : null}
    </header>
  );
}
