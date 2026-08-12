"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LogOut,
  MoreHorizontal,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";

import { logout } from "@/app/actions/auth";

import {
  CRM_NAV,
  INSIGHTS_NAV,
  OPERATIONS_NAV,
  PRIMARY_NAV,
  PURCHASING_NAV,
  SECONDARY_NAV,
  SELLING_NAV,
  TOOLS_NAV,
  type NavigationSection,
} from "../navigation";

type SidebarProps = {
  accountType: string;
  inventoryModules: string[];
  userName: string;
  isOwner: boolean;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggle: () => void;
};

type OpenSection = "purchasing" | "selling" | "insights" | "operations" | null;

const PRIORITY_LIMIT = 4;

export function Sidebar({
  accountType,
  inventoryModules,
  userName,
  isOwner,
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggle,
}: SidebarProps) {
  const pathname = usePathname();
  const isCollector = accountType === "collector";

  const coreItems = useMemo(
    () =>
      PRIMARY_NAV.filter(
        (item) =>
          item.href !== "/dashboard/inventory" ||
          inventoryModules.some((module) =>
            ["singles", "sealed", "graded", "binders", "bulk"].includes(module),
          ),
      ),
    [inventoryModules],
  );

  const detectedSection = useMemo<OpenSection>(() => {
    const sections = [PURCHASING_NAV, SELLING_NAV, INSIGHTS_NAV, OPERATIONS_NAV];
    return (
      sections.find(
        (section) =>
          pathname === section.href ||
          section.children.some(
            (child) => pathname === child.href || pathname.startsWith(`${child.href}/`),
          ),
      )?.id as OpenSection
    ) ?? null;
  }, [pathname]);

  const [openSection, setOpenSection] = useState<OpenSection>(detectedSection);

  useEffect(() => {
    if (detectedSection) setOpenSection(detectedSection);
  }, [detectedSection]);

  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "TD";

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r border-white/[0.055] bg-[#020a12]/98 shadow-[24px_0_80px_rgba(0,0,0,.24)] backdrop-blur-2xl transition-[width,transform] duration-300",
          collapsed ? "w-[76px]" : "w-[256px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-400/[.05] blur-[120px]" />
          <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-blue-300/[.12] to-transparent" />
        </div>

        <SidebarBrand collapsed={collapsed} onNavigate={onCloseMobile} />

        <nav className="relative flex-1 overflow-y-auto px-3 pb-5 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <NavLabel label="Core" collapsed={collapsed} />
          <div className="space-y-1">
            {coreItems.map((item) => (
              <PrimaryLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onCloseMobile}
              />
            ))}
          </div>

          {!isCollector ? (
            <>
              <NavLabel label="Commerce" collapsed={collapsed} spaced />
              <div className="space-y-1">
                <SectionNav
                  section={PURCHASING_NAV}
                  pathname={pathname}
                  collapsed={collapsed}
                  open={openSection === "purchasing"}
                  onToggle={() => setOpenSection(openSection === "purchasing" ? null : "purchasing")}
                  onNavigate={onCloseMobile}
                  priorityHrefs={[
                    "/dashboard/purchasing-intelligence",
                    "/dashboard/collection-buying",
                    "/dashboard/buying-rules",
                    "/dashboard/buylist-intelligence",
                  ]}
                />
                <SectionNav
                  section={SELLING_NAV}
                  pathname={pathname}
                  collapsed={collapsed}
                  open={openSection === "selling"}
                  onToggle={() => setOpenSection(openSection === "selling" ? null : "selling")}
                  onNavigate={onCloseMobile}
                />
                {CRM_NAV.map((item) => (
                  <PrimaryLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                    onNavigate={onCloseMobile}
                  />
                ))}
              </div>

              <NavLabel label="Intelligence" collapsed={collapsed} spaced />
              <SectionNav
                section={INSIGHTS_NAV}
                pathname={pathname}
                collapsed={collapsed}
                open={openSection === "insights"}
                onToggle={() => setOpenSection(openSection === "insights" ? null : "insights")}
                onNavigate={onCloseMobile}
              />

              <NavLabel label="Operations" collapsed={collapsed} spaced />
              <SectionNav
                section={OPERATIONS_NAV}
                pathname={pathname}
                collapsed={collapsed}
                open={openSection === "operations"}
                onToggle={() => setOpenSection(openSection === "operations" ? null : "operations")}
                onNavigate={onCloseMobile}
                priorityHrefs={[
                  "/dashboard/tasks",
                  "/dashboard/calendar",
                  "/dashboard/vendors",
                  "/dashboard/employees",
                ]}
              />
            </>
          ) : null}

          {isCollector && inventoryModules.includes("bulk") ? (
            <>
              <NavLabel label="Purchasing" collapsed={collapsed} spaced />
              <SectionNav
                section={{
                  ...PURCHASING_NAV,
                  children: PURCHASING_NAV.children.filter(
                    (item) => item.href === "/dashboard/bulk-buying",
                  ),
                }}
                pathname={pathname}
                collapsed={collapsed}
                open={openSection === "purchasing"}
                onToggle={() => setOpenSection(openSection === "purchasing" ? null : "purchasing")}
                onNavigate={onCloseMobile}
              />
            </>
          ) : null}

          <NavLabel label="Workspace" collapsed={collapsed} spaced />
          <div className="space-y-1">
            {TOOLS_NAV.map((item) => (
              <PrimaryLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onCloseMobile}
                quiet
              />
            ))}
            {SECONDARY_NAV.map((item) => (
              <PrimaryLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onCloseMobile}
                quiet
              />
            ))}
          </div>
        </nav>

        <AccountFooter
          accountType={accountType}
          userName={userName}
          initials={initials}
          isOwner={isOwner}
          collapsed={collapsed}
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
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <div className="relative flex h-[72px] items-center border-b border-white/[.055] px-3">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className={[
          "group flex min-w-0 flex-1 items-center rounded-2xl transition hover:bg-white/[.025]",
          collapsed ? "justify-center px-0 py-1" : "gap-3 px-1.5 py-1",
        ].join(" ")}
      >
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
          <span className="absolute inset-1 rounded-2xl bg-blue-400/[.1] blur-xl transition group-hover:bg-blue-300/[.18]" />
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
            <span className="block truncate text-sm font-semibold tracking-[-.025em] text-white">
              Trading Docks
            </span>
            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[.2em] text-slate-600">
              Collectibles OS
            </span>
          </span>
        ) : null}
      </Link>
      <button
        type="button"
        onClick={onNavigate}
        aria-label="Close sidebar"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[.07] bg-white/[.025] text-slate-500 lg:hidden"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function NavLabel({
  label,
  collapsed,
  spaced = false,
}: {
  label: string;
  collapsed: boolean;
  spaced?: boolean;
}) {
  if (collapsed) {
    return spaced ? <div className="my-3 h-px bg-white/[.055]" /> : null;
  }
  return (
    <p
      className={[
        "px-3 text-[11px] font-semibold uppercase tracking-[.17em] text-slate-700",
        spaced ? "mb-2 mt-5" : "mb-2",
      ].join(" ")}
    >
      {label}
    </p>
  );
}

function PrimaryLink({
  item,
  pathname,
  collapsed,
  onNavigate,
  quiet = false,
}: {
  item: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  };
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
  quiet?: boolean;
}) {
  const active =
    item.href === "/dashboard"
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={[
        "group relative flex h-10 items-center rounded-[10px] transition duration-200",
        collapsed ? "justify-center" : "gap-3 px-3",
        active
          ? "bg-gradient-to-r from-blue-400/[.13] to-blue-300/[.055] text-white shadow-[inset_0_0_0_1px_rgba(125,211,252,.13)]"
          : quiet
            ? "text-slate-500 hover:bg-white/[.025] hover:text-slate-200"
            : "text-slate-400 hover:bg-white/[.035] hover:text-white",
      ].join(" ")}
    >
      {active ? (
        <span className="absolute inset-y-2 left-0 w-[2px] rounded-r-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.8)]" />
      ) : null}
      <Icon
        className={[
          "h-[18px] w-[18px] shrink-0 transition",
          active ? "text-cyan-300" : "text-blue-300/65 group-hover:text-blue-300",
        ].join(" ")}
      />
      {!collapsed ? (
        <span className={active ? "text-sm font-semibold" : "text-sm font-medium"}>
          {item.label}
        </span>
      ) : null}
    </Link>
  );
}

function SectionNav({
  section,
  pathname,
  collapsed,
  open,
  onToggle,
  onNavigate,
  priorityHrefs,
}: {
  section: NavigationSection;
  pathname: string;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  priorityHrefs?: string[];
}) {
  const active =
    pathname === section.href ||
    section.children.some(
      (child) => pathname === child.href || pathname.startsWith(`${child.href}/`),
    );
  const Icon = section.icon;

  if (collapsed) {
    return (
      <Link
        href={section.href ?? section.children[0]?.href ?? "/dashboard"}
        title={section.label}
        className={[
          "group relative flex h-10 items-center justify-center rounded-[10px] transition",
          active
            ? "bg-blue-400/[.11] text-white shadow-[inset_0_0_0_1px_rgba(125,211,252,.13)]"
            : "text-slate-500 hover:bg-white/[.035]",
        ].join(" ")}
      >
        {active ? (
          <span className="absolute inset-y-2 left-0 w-[2px] rounded-r-full bg-cyan-300" />
        ) : null}
        <Icon className={active ? "h-[18px] w-[18px] text-cyan-300" : "h-[18px] w-[18px] text-blue-300/65"} />
      </Link>
    );
  }

  const priorityChildren = priorityHrefs
    ? priorityHrefs
        .map((href) => section.children.find((child) => child.href === href))
        .filter((item): item is (typeof section.children)[number] => Boolean(item))
    : section.children.slice(0, PRIORITY_LIMIT);

  const activeChild = section.children.find(
    (child) => pathname === child.href || pathname.startsWith(`${child.href}/`),
  );
  const visibleChildren =
    activeChild && !priorityChildren.some((item) => item.href === activeChild.href)
      ? [...priorityChildren.slice(0, PRIORITY_LIMIT - 1), activeChild]
      : priorityChildren;
  const hasMore = section.children.length > visibleChildren.length;

  return (
    <div className="space-y-1">
      <div
        className={[
          "group flex h-10 items-center rounded-[10px] transition",
          active ? "bg-white/[.035]" : "hover:bg-white/[.025]",
        ].join(" ")}
      >
        <Link
          href={section.href ?? section.children[0]?.href ?? "/dashboard"}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-3 px-3"
        >
          <Icon className={active ? "h-[18px] w-[18px] text-cyan-300" : "h-[18px] w-[18px] text-blue-300/65 group-hover:text-blue-300"} />
          <span className={active ? "text-sm font-semibold text-white" : "text-sm font-medium text-slate-400 group-hover:text-white"}>
            {section.label}
          </span>
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${open ? "Collapse" : "Expand"} ${section.label}`}
          aria-expanded={open}
          className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white/[.045] hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
        >
          <ChevronDown className={["h-4 w-4 transition-transform duration-200", open ? "rotate-180" : ""].join(" ")} />
        </button>
      </div>

      {open ? (
        <div className="ml-[21px] border-l border-blue-300/[.11] pl-3">
          <div className="space-y-0.5 py-1">
            {visibleChildren.map((item) => {
              const childActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const ChildIcon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={[
                    "group relative flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 transition",
                    childActive
                      ? "bg-blue-400/[.1] text-white"
                      : "text-slate-500 hover:bg-white/[.03] hover:text-slate-200",
                  ].join(" ")}
                >
                  <ChildIcon className={childActive ? "h-4 w-4 shrink-0 text-cyan-300" : "h-4 w-4 shrink-0 text-blue-300/55 group-hover:text-blue-300"} />
                  <span className={childActive ? "text-[13px] font-semibold" : "text-[13px] font-normal"}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
            {hasMore ? (
              <Link
                href={section.href ?? section.children[0]?.href ?? "/dashboard"}
                onClick={onNavigate}
                className="group flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 text-slate-600 transition hover:bg-white/[.03] hover:text-slate-300"
              >
                <MoreHorizontal className="h-4 w-4 text-blue-300/45 group-hover:text-blue-300" />
                <span className="text-[13px] font-medium">View all {section.label.toLowerCase()}</span>
                <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-50" />
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AccountFooter({
  accountType,
  userName,
  initials,
  isOwner,
  collapsed,
  pathname,
  onNavigate,
  onToggle,
}: {
  accountType: string;
  userName: string;
  initials: string;
  isOwner: boolean;
  collapsed: boolean;
  pathname: string;
  onNavigate: () => void;
  onToggle: () => void;
}) {
  const workspaceLabel = `${accountType.replace("-", " ")} workspace`;
  const adminActive = pathname.startsWith("/dashboard/admin");

  if (collapsed) {
    return (
      <div className="relative border-t border-white/[.055] p-3">
        <div className="flex flex-col items-center gap-2">
          <Link
            href="/dashboard/settings"
            title={`${userName} · ${workspaceLabel}`}
            className="flex h-11 w-11 items-center justify-center rounded-[13px] border border-blue-300/[.17] bg-blue-400/[.07] text-xs font-semibold text-blue-200"
          >
            {initials}
          </Link>
          <button
            type="button"
            onClick={onToggle}
            title="Expand sidebar"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-slate-600 transition hover:bg-white/[.035] hover:text-blue-300"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative border-t border-white/[.055] p-3">
      <div className="rounded-[16px] border border-white/[.075] bg-white/[.02] p-2.5 shadow-[0_14px_35px_rgba(0,0,0,.16)]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-300/[.18] bg-blue-400/[.08] text-xs font-semibold text-blue-200">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold capitalize text-slate-100">{userName}</p>
            <p className="mt-0.5 truncate text-[11px] capitalize text-slate-600">{workspaceLabel}</p>
          </div>
          {isOwner ? (
            <span className="rounded-full border border-amber-300/[.13] bg-amber-300/[.055] px-2 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-amber-200/80">
              Owner
            </span>
          ) : null}
        </div>

        <div className="mt-2.5 grid grid-cols-4 gap-1.5 border-t border-white/[.055] pt-2.5">
          {isOwner ? (
            <Link
              href="/dashboard/admin"
              onClick={onNavigate}
              title="Admin Control Center"
              className={[
                "flex h-9 items-center justify-center rounded-[9px] transition",
                adminActive
                  ? "bg-amber-300/[.08] text-amber-200"
                  : "text-slate-600 hover:bg-white/[.035] hover:text-amber-200",
              ].join(" ")}
            >
              <ShieldCheck className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
          <Link
            href="/dashboard/settings"
            onClick={onNavigate}
            title="Workspace settings"
            className="flex h-9 items-center justify-center rounded-[9px] text-slate-600 transition hover:bg-white/[.035] hover:text-blue-300"
          >
            <Settings2 className="h-4 w-4" />
          </Link>
          <form action={logout}>
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className="flex h-9 w-full items-center justify-center rounded-[9px] text-slate-600 transition hover:bg-red-300/[.045] hover:text-red-300"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
          <button
            type="button"
            onClick={onToggle}
            title="Collapse sidebar"
            className="flex h-9 items-center justify-center rounded-[9px] text-slate-600 transition hover:bg-white/[.035] hover:text-blue-300"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
