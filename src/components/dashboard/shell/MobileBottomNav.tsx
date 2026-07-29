"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, LayoutDashboard, LibraryBig, MessageSquarePlus, Settings } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes, exact: false },
  { href: "/dashboard/deck-vault", label: "Decks", icon: LibraryBig, exact: false },
  { href: "/dashboard/feedback", label: "Feedback", icon: MessageSquarePlus, exact: false },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, exact: false },
] as const;

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

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile dashboard navigation"
      className="fixed inset-x-0 bottom-0 z-40 touch-manipulation border-t border-white/[0.08] bg-[#03101a]/[0.99] px-[max(5px,env(safe-area-inset-left))] pb-[max(6px,env(safe-area-inset-bottom))] pt-1 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] md:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              aria-current={active ? "page" : undefined}
              className={[
                "relative flex min-h-[50px] select-none flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-semibold outline-none touch-manipulation transition-[color,background-color,transform] duration-100 active:scale-[0.94] focus-visible:ring-2 focus-visible:ring-cyan-300/70",
                active
                  ? "bg-cyan-400/[0.12] text-cyan-100"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 active:bg-white/[0.08]",
              ].join(" ")}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span>{label}</span>
              <NavigationStatus />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
