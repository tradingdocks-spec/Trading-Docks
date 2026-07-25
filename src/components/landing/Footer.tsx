import Image from "next/image";

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

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-slate-600">
          <span>© 2026 Trading Docks</span>
          <a href="#" className="transition hover:text-slate-300">Privacy</a>
          <a href="#" className="transition hover:text-slate-300">Terms</a>
          <a href="#" className="transition hover:text-slate-300">Security</a>
        </div>
      </div>
    </footer>
  );
}

