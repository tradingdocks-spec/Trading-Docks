"use client";

import {
  ArrowRight,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { TransitionLink } from "@/components/navigation/PolishedNavigation";
import { BrandMark } from "./BrandMark";
import { NAV_ITEMS } from "./landing-data";
import styles from "./SignatureHero.module.css";

export function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.055] bg-[#02090f]/94 backdrop-blur-2xl">
      <div className="mx-auto flex h-[72px] w-full max-w-[1480px] items-center justify-between px-4 sm:h-[82px] sm:px-8 lg:h-[92px] lg:px-12">
        <BrandMark priority />

        <nav className="hidden items-center gap-2 lg:flex">
          {NAV_ITEMS.map((item, index) => (
            <a
              key={item.href}
              href={item.href}
              className={[
                styles.navItem,
                index === 0 ? styles.navItemActive : "",
              ].join(" ")}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <TransitionLink
            href="/sign-in"
            className="inline-flex h-11 shrink-0 items-center rounded-xl px-4 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
          >
            Log in
          </TransitionLink>
          <TransitionLink
            href="/sign-up"
            className={`${styles.primaryButton} group inline-flex h-12 shrink-0 items-center gap-2 rounded-[15px] bg-gradient-to-b from-cyan-300 via-blue-400 to-blue-600 px-5 text-sm font-semibold text-[#001018] shadow-[0_16px_38px_rgba(59,130,246,0.18),inset_0_1px_0_rgba(255,255,255,0.65),inset_0_-1px_0_rgba(3,105,161,0.3)]`}
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
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.025] text-slate-200 transition active:scale-95 sm:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-x-0 top-[72px] z-50 h-[calc(100dvh-72px)] border-t border-white/[0.05] bg-[#020912]/[0.98] px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-4 backdrop-blur-2xl sm:hidden">
          <nav className="mx-auto flex max-w-md flex-col gap-2">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex min-h-[54px] items-center justify-between rounded-2xl border border-white/[0.065] bg-[#07131f] px-4 text-base font-semibold text-slate-200"
              >
                {item.label}
                <ArrowRight className="h-4 w-4 text-blue-300" />
              </a>
            ))}
          </nav>

          <div className="mx-auto mt-4 grid max-w-md grid-cols-2 gap-3">
            <TransitionLink
              href="/sign-in"
              className="inline-flex h-[52px] items-center justify-center rounded-2xl border border-white/[0.09] bg-white/[0.025] text-sm font-semibold text-white"
            >
              Log in
            </TransitionLink>
            <TransitionLink
              href="/sign-up"
              className="inline-flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-300 text-sm font-semibold text-[#001018]"
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
