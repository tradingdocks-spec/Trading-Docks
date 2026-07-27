import { Anchor } from "lucide-react";

type SidebarLogoProps = {
  collapsed: boolean;
};

export function SidebarLogo({ collapsed }: SidebarLogoProps) {
  return (
    <div
      className={[
        "flex h-16 items-center border-b border-white/[0.06]",
        collapsed ? "justify-center px-3" : "gap-3 px-4",
      ].join(" ")}
    >
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-400/[0.08] shadow-[0_0_30px_rgba(34,211,238,0.08)]">
        <Anchor
          aria-hidden="true"
          className="h-[18px] w-[18px] text-cyan-300"
        />

        <div className="absolute inset-x-2 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
      </div>

      {!collapsed ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-white">
            Trading Docks
          </p>

          <p className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">
            Command Center
          </p>
        </div>
      ) : null}
    </div>
  );
}
