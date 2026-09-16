"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Menu } from "lucide-react";

import { getAccountAwareNavigationGroups, type NavigationItem } from "../navigation";
import type { ClientSafePlatformAccess } from "@/lib/platform/client-access";

const NAV_ITEM_CLASS =
  "group relative m-0 flex h-[60px] min-h-[60px] min-w-0 appearance-none select-none touch-manipulation flex-col items-center justify-center gap-[5px] rounded-[17px] border border-td-accent/[0.09] bg-td-accent/[0.065] px-1 py-0 font-sans text-[11px] font-semibold leading-none !text-td-primary outline-none shadow-[inset_0_1px_0_rgb(var(--td-ink-rgb)/.035)] transition-[filter,box-shadow,transform] duration-200 hover:brightness-110 active:scale-[0.96] active:brightness-125 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-td-accent/70";
const NAV_LABEL_CLASS =
  "block w-full truncate text-center font-sans text-[11px] font-semibold leading-[12px] !text-td-primary opacity-100";
const ACTIVE_CLASS =
  "shadow-[inset_0_1px_0_rgb(var(--td-ink-rgb)/.035),0_5px_18px_rgb(var(--td-accent-rgb)/.10)]";
const INACTIVE_CLASS =
  "shadow-[inset_0_1px_0_rgb(var(--td-ink-rgb)/.035)]";

function NavIcon({
  item,
}: {
  item: Pick<NavigationItem, "icon">;
}) {
  const Icon = item.icon ?? LayoutDashboard;
  return (
    <span
      aria-hidden="true"
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center"
    >
      <Icon className="h-[21px] w-[21px] shrink-0 !stroke-td-primary stroke-[2] opacity-100 drop-shadow-[0_0_7px_rgb(var(--td-accent-rgb)/.16)] transition-transform duration-200 group-hover:-translate-y-px" />
    </span>
  );
}

function NavPresentation({
  item,
  active,
}: {
  item: Pick<NavigationItem, "icon" | "label">;
  active: boolean;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className={[
          "absolute left-1/2 top-0 h-[3px] w-5 -translate-x-1/2 rounded-b-full bg-td-accent transition-opacity duration-150",
          active ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />
      <NavIcon item={item} />
      <span className={NAV_LABEL_CLASS}>{item.label}</span>
    </>
  );
}

function NavigationStatus() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      className={[
        "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-td-accent transition-opacity duration-150",
        pending ? "animate-pulse opacity-100" : "opacity-0",
      ].join(" ")}
    />
  );
}

export function MobileBottomNav({
  accountType,
  isOwner,
  clientAccess,
  menuOpen,
  onOpenMenu,
}: {
  accountType: string;
  isOwner: boolean;
  clientAccess?: ClientSafePlatformAccess;
  menuOpen: boolean;
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();
  const items = getAccountAwareNavigationGroups(accountType, isOwner, clientAccess)
    .flatMap((group) => group.items)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.href === item.href) === index)
    .slice(0, 4);

  return (
    <nav
      aria-label="Mobile dashboard navigation"
      className="fixed inset-x-3 bottom-[max(10px,env(safe-area-inset-bottom))] z-40 touch-manipulation overflow-hidden rounded-[24px] border border-td-accent/[0.12] bg-[linear-gradient(180deg,rgb(var(--td-surface-rgb)/.98),rgb(var(--td-surface-rgb)/.98))] p-[6px] shadow-[0_20px_60px_rgb(var(--td-shadow-rgb)/calc(0.62*var(--td-shadow-strength))),0_0_34px_rgb(var(--td-accent-rgb)/.07),inset_0_1px_0_rgb(var(--td-ink-rgb)/.06)] backdrop-blur-2xl md:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5">
        {items.map((item) => {
          const active = item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              prefetch
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={[
                NAV_ITEM_CLASS,
                active ? ACTIVE_CLASS : INACTIVE_CLASS,
              ].join(" ")}
            >
              <NavPresentation item={item} active={active} />
              <NavigationStatus />
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-expanded={menuOpen}
          aria-label="Open all dashboard menus"
          style={{ color: "var(--td-text-primary)", WebkitTextFillColor: "var(--td-text-primary)" }}
          className={[
            NAV_ITEM_CLASS,
            menuOpen ? ACTIVE_CLASS : INACTIVE_CLASS,
          ].join(" ")}
        >
          <NavPresentation item={{ icon: Menu, label: "Menu" }} active={menuOpen} />
        </button>
      </div>
    </nav>
  );
}
