import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BrandMark } from "./BrandMark";
import { NAV_ITEMS } from "./landing-data";
import styles from "./SignatureHero.module.css";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.055] bg-[#02090f]/86 backdrop-blur-2xl">
      <div className="mx-auto flex h-[92px] w-full max-w-[1480px] items-center justify-between px-5 sm:px-8 lg:px-12">
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

        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden h-11 items-center rounded-xl px-4 text-sm font-medium text-slate-300 transition hover:bg-white/[0.04] hover:text-white sm:inline-flex"
          >
            Sign in
          </Link>

          <Link
            href="/sign-up"
            className={`${styles.primaryButton} group inline-flex h-12 items-center gap-2 rounded-[15px] bg-gradient-to-b from-cyan-300 via-cyan-400 to-sky-500 px-6 text-sm font-semibold text-[#001018] shadow-[0_16px_38px_rgba(34,211,238,0.18),inset_0_1px_0_rgba(255,255,255,0.65),inset_0_-1px_0_rgba(3,105,161,0.3)] transition hover:-translate-y-0.5 hover:brightness-105`}
          >
            <span className="relative z-10">Create your workspace</span>
            <ArrowRight className="relative z-10 h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
