"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  LockKeyhole,
  MoreHorizontal,
  Settings,
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
  type NavigationItem,
  type NavigationSection,
} from "../navigation";
import {
  featureForPath,
  hasPlanAccess,
  minimumPlanName,
  normalizeAccountTier,
} from "@/lib/tier-access";

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

const SECTION_CONFIG: Array<{
  label: string;
  section: NavigationSection;
  priorityCount: number;
}> = [
  { label: "Commerce", section: PURCHASING_NAV, priorityCount: 4 },
  { label: "", section: SELLING_NAV, priorityCount: 4 },
  { label: "Intelligence", section: INSIGHTS_NAV, priorityCount: 4 },
  { label: "Operations", section: OPERATIONS_NAV, priorityCount: 4 },
];

export function TieredSidebar({
  accountType,
  inventoryModules: _inventoryModules,
  userName,
  isOwner,
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggle,
}: SidebarProps) {
  const pathname = usePathname();
  const plan = normalizeAccountTier(accountType);

  const activeSection = useMemo<OpenSection>(() => {
    const matched = SECTION_CONFIG.find(({ section }) =>
      isSectionActive(section, pathname),
    );
    return (matched?.section.id as OpenSection) ?? null;
  }, [pathname]);

  const [openSection, setOpenSection] = useState<OpenSection>(activeSection);

  useEffect(() => {
    if (activeSection) setOpenSection(activeSection);
  }, [activeSection]);

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

        <SidebarBrand
          collapsed={collapsed}
          onCloseMobile={onCloseMobile}
        />

        <nav className="td-sidebar-scroll relative flex-1 overflow-y-auto px-3 pb-5 pt-4">
          <NavigationGroup
            label="Core"
            items={PRIMARY_NAV}
            collapsed={collapsed}
            pathname={pathname}
            plan={plan}
            onNavigate={onCloseMobile}
          />

          {!collapsed ? (
            <SectionLabel className="mt-6">Commerce</SectionLabel>
          ) : (
            <Divider />
          )}

          <NavigationGroup
            items={CRM_NAV}
            collapsed={collapsed}
            pathname={pathname}
            plan={plan}
            onNavigate={onCloseMobile}
          />

          {SECTION_CONFIG.slice(0, 2).map(({ section, priorityCount }) => (
            <ExpandableSection
              key={section.id}
              section={section}
              collapsed={collapsed}
              pathname={pathname}
              plan={plan}
              open={openSection === section.id}
              priorityCount={priorityCount}
              onToggle={() =>
                setOpenSection((current) =>
                  current === section.id ? null : (section.id as OpenSection),
                )
              }
              onExpandCollapsed={() => {
                onToggle();
                setOpenSection(section.id as OpenSection);
              }}
              onNavigate={onCloseMobile}
            />
          ))}

          {!collapsed ? (
            <SectionLabel className="mt-6">Intelligence</SectionLabel>
          ) : (
            <Divider />
          )}

          <ExpandableSection
            section={INSIGHTS_NAV}
            collapsed={collapsed}
            pathname={pathname}
            plan={plan}
            open={openSection === "insights"}
            priorityCount={4}
            onToggle={() =>
              setOpenSection((current) =>
                current === "insights" ? null : "insights",
              )
            }
            onExpandCollapsed={() => {
              onToggle();
              setOpenSection("insights");
            }}
            onNavigate={onCloseMobile}
          />

          {!collapsed ? (
            <SectionLabel className="mt-6">Operations</SectionLabel>
          ) : (
            <Divider />
          )}

          <ExpandableSection
            section={OPERATIONS_NAV}
            collapsed={collapsed}
            pathname={pathname}
            plan={plan}
            open={openSection === "operations"}
            priorityCount={4}
            onToggle={() =>
              setOpenSection((current) =>
                current === "operations" ? null : "operations",
              )
            }
            onExpandCollapsed={() => {
              onToggle();
              setOpenSection("operations");
            }}
            onNavigate={onCloseMobile}
          />

          {!collapsed ? (
            <SectionLabel className="mt-6">Workspace</SectionLabel>
          ) : (
            <Divider />
          )}

          <NavigationGroup
            items={[...TOOLS_NAV, ...SECONDARY_NAV]}
            collapsed={collapsed}
            pathname={pathname}
            plan={plan}
            onNavigate={onCloseMobile}
          />
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
        className={[
          "group flex min-w-0 flex-1 items-center rounded-xl transition hover:bg-white/[0.025]",
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
        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/[0.04] hover:text-white xl:hidden"
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
  plan,
  onNavigate,
}: {
  label?: string;
  items: ReadonlyArray<NavigationItem>;
  collapsed: boolean;
  pathname: string;
  plan: ReturnType<typeof normalizeAccountTier>;
  onNavigate: () => void;
}) {
  return (
    <div>
      {label && !collapsed ? <SectionLabel>{label}</SectionLabel> : null}
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavigationRow
            key={item.href}
            item={item}
            collapsed={collapsed}
            pathname={pathname}
            plan={plan}
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
  plan,
  onNavigate,
}: {
  item: NavigationItem;
  collapsed: boolean;
  pathname: string;
  plan: ReturnType<typeof normalizeAccountTier>;
  onNavigate: () => void;
}) {
  const feature = featureForPath(item.href);
  const allowed = hasPlanAccess(plan, feature);
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
        "group relative flex min-h-10 items-center rounded-xl transition duration-200",
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
              {minimumPlanName(feature)}
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

function ExpandableSection({
  section,
  collapsed,
  pathname,
  plan,
  open,
  priorityCount,
  onToggle,
  onExpandCollapsed,
  onNavigate,
}: {
  section: NavigationSection;
  collapsed: boolean;
  pathname: string;
  plan: ReturnType<typeof normalizeAccountTier>;
  open: boolean;
  priorityCount: number;
  onToggle: () => void;
  onExpandCollapsed: () => void;
  onNavigate: () => void;
}) {
  const active = isSectionActive(section, pathname);
  const feature = featureForPath(section.href ?? section.children[0]?.href ?? "/dashboard");
  const allowed =
    hasPlanAccess(plan, feature) ||
    section.children.some((child) =>
      hasPlanAccess(plan, featureForPath(child.href)),
    );
  const Icon = section.icon;

  const visibleChildren = useMemo(() => {
    const preferred = section.children.slice(0, priorityCount);
    const activeChild = section.children.find(
      (child) =>
        pathname === child.href || pathname.startsWith(`${child.href}/`),
    );

    if (
      activeChild &&
      !preferred.some((child) => child.href === activeChild.href) &&
      preferred.length
    ) {
      return [...preferred.slice(0, -1), activeChild];
    }

    return preferred;
  }, [pathname, priorityCount, section.children]);

  if (collapsed) {
    return (
      <button
        type="button"
        title={section.label}
        onClick={onExpandCollapsed}
        className={[
          "group relative mt-0.5 flex h-10 w-full items-center justify-center rounded-xl transition",
          active
            ? "bg-gradient-to-r from-blue-500/[0.15] to-cyan-300/[0.045] text-white"
            : "text-slate-500 hover:bg-white/[0.035] hover:text-white",
        ].join(" ")}
      >
        {active ? (
          <span className="absolute inset-y-2 left-0 w-[2px] rounded-r-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,.72)]" />
        ) : null}
        <Icon
          className={[
            "h-[17px] w-[17px]",
            active
              ? "text-cyan-200"
              : "text-blue-300/65 group-hover:text-blue-200",
          ].join(" ")}
        />
      </button>
    );
  }

  return (
    <div className="mt-0.5">
      <div className="group relative flex min-h-10 items-center rounded-xl transition hover:bg-white/[0.03]">
        {active ? (
          <span className="absolute inset-y-2 left-0 w-[2px] rounded-r-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,.72)]" />
        ) : null}

        <Link
          href={section.href ?? visibleChildren[0]?.href ?? "/dashboard"}
          onClick={onNavigate}
          className={[
            "flex min-w-0 flex-1 items-center gap-3 px-3",
            active ? "text-white" : "text-slate-400 group-hover:text-white",
          ].join(" ")}
        >
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

          <span className="truncate text-[14px] font-medium">
            {section.label}
          </span>

          {!allowed ? (
            <span className="ml-auto rounded-full border border-blue-300/[0.11] bg-blue-400/[0.035] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-200/65">
              {minimumPlanName(feature)}
            </span>
          ) : null}
        </Link>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${section.label}`}
          className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 opacity-75 outline-none transition hover:bg-white/[0.045] hover:text-blue-200 focus-visible:ring-2 focus-visible:ring-blue-300/45 group-hover:opacity-100"
        >
          <ChevronDown
            className={[
              "h-3.5 w-3.5 transition-transform duration-200",
              open ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>
      </div>

      <div
        className={[
          "grid transition-[grid-template-rows,opacity] duration-200",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <div className="relative ml-[20px] mt-1 space-y-0.5 border-l border-white/[0.065] pb-1 pl-3">
            {visibleChildren.map((child) => {
              const childActive =
                pathname === child.href ||
                pathname.startsWith(`${child.href}/`);
              const childFeature = featureForPath(child.href);
              const childAllowed = hasPlanAccess(plan, childFeature);
              const ChildIcon = child.icon;

              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  className={[
                    "group flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition",
                    childActive
                      ? "bg-blue-400/[0.075] text-white"
                      : "text-slate-500 hover:bg-white/[0.03] hover:text-slate-200",
                  ].join(" ")}
                >
                  {childAllowed ? (
                    <ChildIcon
                      className={[
                        "h-4 w-4 shrink-0",
                        childActive
                          ? "text-cyan-200"
                          : "text-blue-300/55 group-hover:text-blue-200",
                      ].join(" ")}
                    />
                  ) : (
                    <LockKeyhole className="h-4 w-4 shrink-0 text-blue-300/45" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {child.label}
                  </span>
                  {!childAllowed ? (
                    <span className="rounded-full border border-blue-300/[0.1] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-200/55">
                      {minimumPlanName(childFeature)}
                    </span>
                  ) : null}
                </Link>
              );
            })}

            {section.children.length > priorityCount ? (
              <Link
                href={section.href ?? section.children[0]?.href ?? "/dashboard"}
                onClick={onNavigate}
                className="group flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-slate-600 transition hover:bg-white/[0.03] hover:text-blue-200"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="text-[13px] font-medium">
                  View all {section.label.toLowerCase()} tools
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
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
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white/[0.04] hover:text-blue-200"
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
              {plan === "business" ? "Store workspace" : `${plan} workspace`}
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
              className="flex h-9 w-full items-center justify-center rounded-lg text-slate-600 transition hover:bg-red-400/[0.055] hover:text-red-300"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>

          <button
            type="button"
            onClick={onToggle}
            title="Collapse navigation"
            aria-label="Collapse navigation"
            className="flex h-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white/[0.04] hover:text-blue-200"
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
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={label}
      aria-label={label}
      className={[
        "flex h-9 items-center justify-center rounded-lg transition",
        active
          ? "bg-blue-400/[0.09] text-cyan-200"
          : "text-slate-600 hover:bg-white/[0.04] hover:text-blue-200",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.17em] text-slate-700 ${className}`}
    >
      {children}
    </p>
  );
}

function Divider() {
  return (
    <div className="mx-auto my-3 h-px w-8 bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />
  );
}

function isSectionActive(section: NavigationSection, pathname: string) {
  return (
    pathname === section.href ||
    section.children.some(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
  );
}
