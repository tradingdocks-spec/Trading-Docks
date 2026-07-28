"use client";

import Link from "next/link";
import {
  BarChart3,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  FolderPlus,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  PackagePlus,
  Plus,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";

import { logout } from "@/app/actions/auth";
import {
  normalizeAccountTier,
  PLAN_ENTITLEMENTS,
  type AccountTier,
} from "@/lib/plan-entitlements";
import { NotificationBell } from "../notifications/NotificationBell";
import { GlobalSearch } from "../search/GlobalSearch";

export function Topbar({
  collapsed,
  onOpenMobile,
  accountType = "free",
  userName = "Trading Docks",
  isOwner = false,
}: {
  collapsed: boolean;
  onOpenMobile: () => void;
  accountType?: string;
  userName?: string;
  isOwner?: boolean;
}) {
  const plan = normalizeAccountTier(accountType);
  const [openMenu, setOpenMenu] = useState<"create" | "workspace" | "profile" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TD";

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(null);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const createItems = useMemo(() => {
    const items = [
      { label: "Add inventory card", href: "/dashboard/inventory?create=card", icon: PackagePlus, minimum: "free" as AccountTier },
      { label: "Create deck", href: "/dashboard/deck-vault?create=deck", icon: LibraryBig, minimum: "free" as AccountTier },
      { label: "Create binder or box", href: "/dashboard/inventory?create=location", icon: FolderPlus, minimum: "collector" as AccountTier },
      { label: "Create marketplace listing", href: "/dashboard/marketplaces?create=listing", icon: ShoppingBag, minimum: "seller" as AccountTier },
      { label: "Record store expense", href: "/dashboard/finances?create=expense", icon: CreditCard, minimum: "business" as AccountTier },
    ];
    const rank: Record<AccountTier, number> = { free: 0, collector: 1, seller: 2, business: 3 };
    return items.filter((item) => rank[plan] >= rank[item.minimum]);
  }, [plan]);

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-30 h-[72px] border-b border-white/[0.055] bg-[#041019]/84 backdrop-blur-2xl transition-[padding-left] duration-300",
        collapsed ? "lg:pl-[88px]" : "lg:pl-[258px]",
      ].join(" ")}
    >
      <div className="flex h-full items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMobile}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-500 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <GlobalSearch />

        <div ref={menuRef} className="relative ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenMenu((value) => value === "create" ? null : "create")}
            aria-expanded={openMenu === "create"}
            className="hidden h-10 items-center gap-2 rounded-xl border border-cyan-300/[0.15] bg-cyan-400/[0.07] px-4 text-xs font-semibold text-cyan-100 transition hover:-translate-y-px hover:bg-cyan-400/[0.11] sm:flex"
          >
            <Plus className="h-4 w-4 text-cyan-300" />
            Create
          </button>

          <NotificationBell plan={plan} />

          <button
            type="button"
            onClick={() => setOpenMenu((value) => value === "workspace" ? null : "workspace")}
            aria-expanded={openMenu === "workspace"}
            className="hidden h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs text-slate-400 md:flex"
          >
            <Store className="h-4 w-4 text-slate-600" />
            Trading Docks
            <ChevronDown className="h-3.5 w-3.5 text-slate-700" />
          </button>

          <button
            type="button"
            onClick={() => setOpenMenu((value) => value === "profile" ? null : "profile")}
            aria-expanded={openMenu === "profile"}
            className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1.5 pr-2 text-xs text-slate-400"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/[0.1] font-semibold text-cyan-200">
              {initials}
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-700 sm:block" />
          </button>

          {openMenu === "create" ? (
            <TopbarMenu className="right-[250px] top-12 w-64">
              <MenuHeading title="Create" subtitle={`${PLAN_ENTITLEMENTS[plan].name} plan actions`} onClose={() => setOpenMenu(null)} />
              <div className="p-2">
                {createItems.map((item) => (
                  <MenuLink key={item.label} href={item.href} label={item.label} icon={item.icon} onClick={() => setOpenMenu(null)} />
                ))}
              </div>
            </TopbarMenu>
          ) : null}

          {openMenu === "workspace" ? (
            <TopbarMenu className="right-12 top-12 w-72">
              <MenuHeading title="Trading Docks" subtitle="Workspace and subscription" onClose={() => setOpenMenu(null)} />
              <div className="border-b border-white/[0.06] p-3">
                <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/[0.05] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{PLAN_ENTITLEMENTS[plan].name} plan</span>
                    <Check className="h-4 w-4 text-cyan-300" />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {PLAN_ENTITLEMENTS[plan].inventoryLimit.toLocaleString()} cards
                    {PLAN_ENTITLEMENTS[plan].deckLimit ? ` · ${PLAN_ENTITLEMENTS[plan].deckLimit} decks` : " · Unlimited decks"}
                  </p>
                </div>
              </div>
              <div className="p-2">
                <MenuLink href="/dashboard" label="Workspace overview" icon={LayoutDashboard} onClick={() => setOpenMenu(null)} />
                <MenuLink href="/dashboard/plans" label="Compare plans & pricing" icon={BarChart3} onClick={() => setOpenMenu(null)} />
                <MenuLink href="/dashboard/settings?section=billing" label="Billing & subscription" icon={CreditCard} onClick={() => setOpenMenu(null)} />
                <MenuLink href="/dashboard/settings?section=workspace" label="Workspace settings" icon={Settings} onClick={() => setOpenMenu(null)} />
                {isOwner ? <MenuLink href="/dashboard/admin" label="Admin Control Center" icon={ShieldCheck} onClick={() => setOpenMenu(null)} /> : null}
              </div>
            </TopbarMenu>
          ) : null}

          {openMenu === "profile" ? (
            <TopbarMenu className="right-0 top-12 w-64">
              <MenuHeading title={userName} subtitle={`${PLAN_ENTITLEMENTS[plan].name} account`} onClose={() => setOpenMenu(null)} />
              <div className="p-2">
                <MenuLink href="/dashboard/settings?section=profile" label="Profile" icon={UserRound} onClick={() => setOpenMenu(null)} />
                <MenuLink href="/dashboard/settings" label="Preferences & security" icon={Settings} onClick={() => setOpenMenu(null)} />
                <MenuLink href="/dashboard/settings?section=help" label="Help & support" icon={CircleHelp} onClick={() => setOpenMenu(null)} />
              </div>
              <form action={logout} className="border-t border-white/[0.06] p-2">
                <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-red-200 transition hover:bg-red-400/[0.07]">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </form>
            </TopbarMenu>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function TopbarMenu({ children, className }: { children: ReactNode; className: string }) {
  return <div className={`absolute z-[80] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#07131d]/[0.99] shadow-[0_28px_80px_rgba(0,0,0,0.58)] backdrop-blur-2xl ${className}`}>{children}</div>;
}

function MenuHeading({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return <div className="flex items-start justify-between border-b border-white/[0.06] px-4 py-3.5"><div><p className="text-xs font-semibold text-white">{title}</p><p className="mt-1 text-[9px] text-slate-500">{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Close menu" className="rounded-md p-1 text-slate-600 hover:bg-white/[0.05] hover:text-white"><X className="h-3.5 w-3.5" /></button></div>;
}

function MenuLink({ href, label, icon: Icon, onClick }: { href: string; label: string; icon: ComponentType<{ className?: string }>; onClick: () => void }) {
  return <Link href={href} onClick={onClick} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-300 transition hover:bg-cyan-400/[0.055] hover:text-cyan-100"><Icon className="h-4 w-4 text-slate-500" /><span>{label}</span></Link>;
}
