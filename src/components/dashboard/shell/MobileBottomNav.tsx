"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, LayoutDashboard, LibraryBig, Menu, Settings } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes, exact: false },
  { href: "/dashboard/deck-vault", label: "Decks", icon: LibraryBig, exact: false },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, exact: false },
] as const;

const NAV_ITEM_CLASS =
  "relative flex min-h-[58px] min-w-0 select-none touch-manipulation flex-col items-center justify-center gap-1.5 rounded-[16px] px-1 text-center text-[10px] font-semibold leading-none tracking-[-0.01em] outline-none transition-[color,background-color,transform] duration-150 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-cyan-300/70";

function NavIcon({
  icon: Icon,
}: {
  icon: typeof LayoutDashboard;
}) {
  return (
    <span
      aria-hidden="true"
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center"
    >
      <Icon className="h-5 w-5 shrink-0 stroke-[1.9]" />
    </span>
  );
}

function NavigationStatus() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      className={[
        "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-cyan-300 transition-opacity duration-150",
        pending ? "animate-pulse opacity-100" : "opacity-0",
      ].join(" ")}
    />
  );
}

export function MobileBottomNav({
  menuOpen,
  onOpenMenu,
}: {
  menuOpen: boolean;
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile dashboard navigation"
      className="fixed inset-x-3 bottom-[max(10px,env(safe-area-inset-bottom))] z-40 touch-manipulation rounded-[24px] border border-cyan-100/[0.1] bg-[#06141e]/[0.97] p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.62),inset_0_1px_0_rgba(255,255,255,.045)] backdrop-blur-2xl md:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5">
        {ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              aria-current={active ? "page" : undefined}
              className={[
                NAV_ITEM_CLASS,
                active
                  ? "bg-cyan-400/[0.11] text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,.08)]"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 active:bg-white/[0.08]",
              ].join(" ")}
            >
              <NavIcon icon={Icon} />
              <span className="w-full truncate">{label}</span>
              <NavigationStatus />
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-expanded={menuOpen}
          aria-label="Open all dashboard menus"
          className={[
            NAV_ITEM_CLASS,
            menuOpen
              ? "bg-cyan-400/[0.12] text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,.08)]"
              : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 active:bg-white/[0.08]",
          ].join(" ")}
        >
          <NavIcon icon={Menu} />
          <span className="w-full truncate">Menu</span>
        </button>
      </div>
    </nav>
  );
}
