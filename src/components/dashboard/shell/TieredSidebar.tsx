"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  LockKeyhole,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";

import { logout } from "@/app/actions/auth";
import {
  getAccountAwareNavigationGroups,
  type NavigationItem,
} from "../navigation";
import {
  normalizeAccountTier,
} from "@/lib/tier-access";
import {
  canShowRoute,
  clientAccessFromTier,
  type ClientSafePlatformAccess,
} from "@/lib/platform/client-access";
import { requiredMembershipLabelForRoute } from "@/lib/platform/route-access";
import { LABEL_STUDIO_ROUTE } from "@/lib/label-studio/routes";

type SidebarProps = {
  accountType: string;
  inventoryModules: string[];
  userName: string;
  isOwner: boolean;
  clientAccess?: ClientSafePlatformAccess;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggle: () => void;
};

export function TieredSidebar({
  accountType,
  userName,
  isOwner,
  clientAccess,
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggle,
}: SidebarProps) {
  const pathname = usePathname();
  const plan = normalizeAccountTier(accountType);
  const accessForNavigation = clientAccess ?? clientAccessFromTier(plan, {
    platformRole: isOwner ? "admin" : "user",
  });
  const groups = getAccountAwareNavigationGroups(plan, isOwner, accessForNavigation);

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm xl:hidden"
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[min(88vw,340px)] flex-col overflow-hidden border-r border-white/[0.055] bg-[#020a12]/[0.985] shadow-[28px_0_90px_rgba(0,0,0,.42)] backdrop-blur-2xl transition-[width,transform] duration-300 xl:w-auto",
          collapsed ? "xl:w-[76px]" : "xl:w-[264px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-16 h-72 w-72 rounded-full bg-blue-500/[0.055] blur-[115px]" />
          <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-blue-300/[0.11] to-transparent" />
        </div>

        <SidebarBrand collapsed={collapsed} onCloseMobile={onCloseMobile} />

        <nav
          aria-label="Dashboard navigation"
          className="td-sidebar-scroll relative flex-1 overflow-y-auto px-3 pb-5 pt-4"
        >
          {groups.map((group, index) => (
            <div key={group.id}>
              {index > 0 ? <Divider /> : null}
              <NavigationGroup
                label={group.label}
                items={group.items}
                collapsed={collapsed}
                pathname={pathname}
                clientAccess={accessForNavigation}
                onNavigate={onCloseMobile}
              />
            </div>
          ))}
        </nav>

        <WorkspaceFooter
          collapsed={collapsed}
          userName={userName}
          plan={plan}
          isOwner={isOwner}
          pathname={pathname}
          onNavigate={onCloseMobile}
          onToggle={onToggle}
        />
      </aside>
    </>
  );
}

function SidebarBrand({
  collapsed,
  onCloseMobile,
}: {
  collapsed: boolean;
  onCloseMobile: () => void;
}) {
  return (
    <div className="relative flex h-[72px] items-center px-3">
      <Link
        href="/dashboard"
        onClick={onCloseMobile}
        aria-label="Trading Docks dashboard"
        className={[
          "group flex min-w-0 flex-1 items-center rounded-xl transition hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/45",
          collapsed ? "justify-center px-1 py-2" : "gap-3 px-2 py-2",
        ].join(" ")}
      >
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
          <span className="absolute inset-1 rounded-2xl bg-blue-400/[0.12] blur-xl transition group-hover:bg-blue-300/[0.19]" />
          <Image
            src="/trading-docks-mark.png"
            alt="Trading Docks"
            width={1024}
            height={1024}
            priority
            className="relative h-11 w-11 object-contain transition duration-300 group-hover:-translate-y-0.5"
          />
        </span>

        {!collapsed ? (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-[-0.025em] text-white">
              Trading Docks
            </span>
            <span className="mt-0.5 block text-[10px] uppercase tracking-[0.19em] text-slate-600">
              Collectibles OS
            </span>
          </span>
        ) : null}
      </Link>

      <button
        type="button"
        onClick={onCloseMobile}
        aria-label="Close navigation"
        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/45 xl:hidden"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function NavigationGroup({
  label,
  items,
  collapsed,
  pathname,
  clientAccess,
  onNavigate,
}: {
  label?: string;
  items: ReadonlyArray<NavigationItem>;
  collapsed: boolean;
  pathname: string;
  clientAccess: ClientSafePlatformAccess;
  onNavigate: () => void;
}) {
  return (
    <div>
      {label && !collapsed ? <SectionLabel>{label}</SectionLabel> : null}
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavigationRow
            key={`${item.href}-${item.label}`}
            item={item}
            collapsed={collapsed}
            pathname={pathname}
            clientAccess={clientAccess}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}

function NavigationRow({
  item,
  collapsed,
  pathname,
  clientAccess,
  onNavigate,
}: {
  item: NavigationItem;
  collapsed: boolean;
  pathname: string;
  clientAccess: ClientSafePlatformAccess;
  onNavigate: () => void;
}) {
  const allowed = canShowRoute(clientAccess, item.href, process.env.NODE_ENV);
  const requiredPlan = requiredMembershipLabelForRoute(item.href);
  const active =
    item.href === "/dashboard"
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  if (item.href === LABEL_STUDIO_ROUTE && !allowed) return null;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={[
        "group relative flex min-h-10 items-center rounded-xl outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-blue-300/45",
        collapsed ? "justify-center px-0" : "gap-3 px-3",
        active
          ? "bg-gradient-to-r from-blue-500/[0.15] to-cyan-300/[0.045] text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,.08)]"
          : "text-slate-400 hover:bg-white/[0.035] hover:text-white",
      ].join(" ")}
    >
      {active ? (
        <span className="absolute inset-y-2 left-0 w-[2px] rounded-r-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,.72)]" />
      ) : null}

      {allowed ? (
        <Icon
          className={[
            "h-[17px] w-[17px] shrink-0 transition",
            active
              ? "text-cyan-200"
              : "text-blue-300/65 group-hover:text-blue-200",
          ].join(" ")}
        />
      ) : (
        <LockKeyhole className="h-[17px] w-[17px] shrink-0 text-blue-300/55" />
      )}

      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
            {item.label}
          </span>
          {!allowed ? (
            <span className="rounded-full border border-blue-300/[0.11] bg-blue-400/[0.035] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-200/65">
              {requiredPlan ?? "Upgrade"}
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

function WorkspaceFooter({
  collapsed,
  userName,
  plan,
  isOwner,
  pathname,
  onNavigate,
  onToggle,
}: {
  collapsed: boolean;
  userName: string;
  plan: ReturnType<typeof normalizeAccountTier>;
  isOwner: boolean;
  pathname: string;
  onNavigate: () => void;
  onToggle: () => void;
}) {
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TD";

  if (collapsed) {
    return (
      <div className="relative border-t border-white/[0.055] p-2.5">
        <div className="flex flex-col items-center gap-2">
          <div
            title={userName}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-400/[0.08] text-xs font-semibold text-blue-100"
          >
            {initials}
          </div>
          <button
            type="button"
            onClick={onToggle}
            title="Expand navigation"
            aria-label="Expand navigation"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white/[0.04] hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/45"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative border-t border-white/[0.055] p-3">
      <div className="rounded-2xl bg-white/[0.022] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,.055)]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-400/[0.08] text-xs font-semibold text-blue-100">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold capitalize text-slate-100">
              {userName}
            </p>
            <p className="mt-0.5 text-[11px] capitalize text-slate-600">
              {plan === "store" ? "Store workspace" : `${plan} workspace`}
            </p>
          </div>
          {isOwner ? (
            <span className="rounded-full border border-amber-300/15 bg-amber-300/[0.055] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200">
              Owner
            </span>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1 border-t border-white/[0.055] pt-2">
          <FooterAction
            href="/dashboard/settings"
            label="Settings"
            active={pathname.startsWith("/dashboard/settings")}
            onNavigate={onNavigate}
          >
            <Settings className="h-4 w-4" />
          </FooterAction>

          {isOwner ? (
            <FooterAction
              href="/dashboard/admin"
              label="Admin"
              active={pathname.startsWith("/dashboard/admin")}
              onNavigate={onNavigate}
            >
              <ShieldCheck className="h-4 w-4" />
            </FooterAction>
          ) : (
            <span />
          )}

          <form action={logout}>
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className="flex h-9 w-full items-center justify-center rounded-lg text-slate-600 transition hover:bg-red-400/[0.055] hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/45"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>

          <button
            type="button"
            onClick={onToggle}
            title="Collapse navigation"
            aria-label="Collapse navigation"
            className="flex h-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white/[0.04] hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/45"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FooterAction({
  href,
  label,
  active,
  onNavigate,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={[
        "flex h-9 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/45",
        active
          ? "bg-blue-400/[0.09] text-cyan-200"
          : "text-slate-600 hover:bg-white/[0.04] hover:text-blue-200",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.17em] text-slate-700">
      {children}
    </p>
  );
}

function Divider() {
  return (
    <div className="mx-auto my-3 h-px w-8 bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />
  );
}
