import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/[0.05]">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <Image
          src="/trading-docks-horizontal.png"
          alt="Trading Docks"
          width={2048}
          height={682}
          className="h-auto w-[220px] object-contain object-left"
        />

        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-slate-500">
            <span>© 2026 Trading Docks. All rights reserved.</span>
            <Link href="/privacy" className="transition hover:text-slate-300">Privacy Policy</Link>
            <Link href="/terms" className="transition hover:text-slate-300">Terms of Service</Link>
            <Link href="/security" className="transition hover:text-slate-300">Security</Link>
          </div>
          <p className="mt-4 text-[10px] leading-5 text-slate-700">
            Trading Docks is an independent inventory and business-management platform and is not affiliated with or endorsed by the publishers or owners of the supported trading-card games. Product names and trademarks belong to their respective owners. Market values are estimates and are not guarantees of sale price.
          </p>
        </div>
      </div>
    </footer>
  );
}
