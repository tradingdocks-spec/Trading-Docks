"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

import {
  BUSINESS_NAV,
  PRIMARY_NAV,
  PRIMARY_NAV_AFTER_PURCHASING,
  PURCHASING_NAV,
  SECONDARY_NAV,
} from "../navigation";

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggle: () => void;
};

export function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggle,
}: SidebarProps) {
  const pathname = usePathname();
  const purchasingActive =
    pathname === PURCHASING_NAV.href ||
    PURCHASING_NAV.children.some((item) =>
      pathname.startsWith(item.href),
    );
  const [purchasingOpen, setPurchasingOpen] =
    useState(purchasingActive);
  const businessActive = BUSINESS_NAV.some((item) => pathname.startsWith(item.href));
  const [businessOpen, setBusinessOpen] = useState(businessActive);

  useEffect(() => {
    if (purchasingActive) setPurchasingOpen(true);
  }, [purchasingActive]);

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
          "fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r border-td-ink/[0.055] bg-td-canvas/97 shadow-[22px_0_70px_rgb(var(--td-shadow-rgb)/calc(0.22*var(--td-shadow-strength)))] backdrop-blur-2xl transition-all duration-300",
          collapsed ? "w-[88px]" : "w-[258px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-20 h-72 w-72 rounded-full bg-td-accent/[0.055] blur-[110px]" />
          <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-td-accent/[0.13] to-transparent" />
        </div>

        <div className="relative flex h-[72px] items-center border-b border-td-ink/[0.055] px-3">
          <Link
            href="/dashboard"
            onClick={onCloseMobile}
            className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-1.5 transition hover:bg-td-ink/[0.025]"
          >
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
              <span className="absolute inset-1 rounded-2xl bg-td-accent/[0.12] blur-xl transition group-hover:bg-td-accent/[0.2]" />
              <Image
                src="/trading-docks-mark.png"
                alt=""
                width={1024}
                height={1024}
                priority
                className="relative h-12 w-12 object-contain transition duration-500 group-hover:-translate-y-0.5 group-hover:scale-105"
              />
            </span>

            {!collapsed ? (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-[-0.025em] text-td-primary">
                  Trading Docks
                </span>
                <span className="mt-0.5 block text-[11px] uppercase tracking-[0.24em] text-td-muted">
                  Collectibles OS
                </span>
              </span>
            ) : null}
          </Link>

          <button
            type="button"
            onClick={onCloseMobile}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.025] text-td-muted lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="relative flex-1 overflow-y-auto px-3 py-4">
          <NavGroup
            label="Core workspace"
            items={PRIMARY_NAV}
            collapsed={collapsed}
            pathname={pathname}
            onNavigate={onCloseMobile}
          />

          <PurchasingNav
            collapsed={collapsed}
            pathname={pathname}
            open={purchasingOpen}
            setOpen={setPurchasingOpen}
            onNavigate={onCloseMobile}
          />

          <NavGroup
            items={PRIMARY_NAV_AFTER_PURCHASING}
            collapsed={collapsed}
            pathname={pathname}
            onNavigate={onCloseMobile}
          />

          <div className="my-4 h-px bg-gradient-to-r from-transparent via-white/[0.075] to-transparent" />

          {collapsed ? (
            <button
              type="button"
              title="Business tools"
              onClick={() => {
                onToggle();
                setBusinessOpen(true);
              }}
              className="flex h-10 w-full items-center justify-center rounded-xl text-td-muted transition hover:bg-td-ink/[0.025] hover:text-td-accent-text"
            >
              <BriefcaseBusiness className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setBusinessOpen((value) => !value)}
              className="mb-1 flex h-10 w-full items-center gap-3 rounded-xl px-3 text-td-muted transition hover:bg-td-ink/[0.025] hover:text-td-primary"
            >
              <BriefcaseBusiness className="h-4 w-4" />
              <span className="flex-1 text-left text-[11px] font-medium">Business tools</span>
              <ChevronDown className={`h-3.5 w-3.5 transition ${businessOpen ? "rotate-180" : ""}`} />
            </button>
          )}

          {businessOpen ? (
            <div className="ml-2 border-l border-td-ink/[0.06] pl-2">
              <NavGroup
                items={BUSINESS_NAV}
                collapsed={collapsed}
                pathname={pathname}
                onNavigate={onCloseMobile}
              />
            </div>
          ) : null}

          <div className="my-4 h-px bg-gradient-to-r from-transparent via-white/[0.075] to-transparent" />

          <NavGroup
            items={SECONDARY_NAV}
            collapsed={collapsed}
            pathname={pathname}
            onNavigate={onCloseMobile}
          />
        </nav>

        <div className="relative border-t border-td-ink/[0.055] p-3">
          <div
            className={[
              "flex items-center rounded-2xl border border-td-ink/[0.07] bg-td-ink/[0.018] p-2.5",
              collapsed ? "justify-center" : "gap-3",
            ].join(" ")}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-td-accent/20 bg-td-accent/[0.08] text-xs font-semibold text-td-accent-text">
              JR
            </div>

            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-td-primary">Jeremy</p>
                <p className="mt-0.5 text-[11px] text-td-muted">Personal workspace</p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-td-ink/[0.06] bg-td-ink/[0.018] text-td-muted transition hover:border-td-accent/20 hover:text-td-accent-text"
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function PurchasingNav({
  collapsed,
  pathname,
  open,
  setOpen,
  onNavigate,
}: {
  collapsed: boolean;
  pathname: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  onNavigate: () => void;
}) {
  const active =
    pathname === PURCHASING_NAV.href ||
    PURCHASING_NAV.children.some((item) =>
      pathname.startsWith(item.href),
    );
  const Icon = PURCHASING_NAV.icon;

  if (collapsed) {
    return (
      <Link
        href={PURCHASING_NAV.href ?? "/dashboard/purchasing"}
        title="Purchasing"
        className={[
          "group relative mt-1 flex h-10 items-center justify-center overflow-hidden rounded-xl border transition duration-300",
          active
            ? "border-td-accent/[0.18] bg-td-accent/[0.065] text-td-primary"
            : "border-transparent text-td-muted hover:border-td-ink/[0.06] hover:bg-td-ink/[0.025]",
        ].join(" ")}
      >
        {active ? (
          <span className="absolute inset-y-2 left-0 w-[2px] rounded-r-full bg-td-accent shadow-[0_0_10px_rgb(var(--td-accent-rgb)/0.8)]" />
        ) : null}
        <Icon
          className={[
            "h-4 w-4",
            active
              ? "text-td-accent-text"
              : "text-td-muted group-hover:text-td-accent-text/80",
          ].join(" ")}
        />
      </Link>
    );
  }

  return (
    <div className="mt-1">
      <div
        className={[
          "relative overflow-hidden rounded-xl border transition",
          active
            ? "border-td-accent/[0.13] bg-td-accent/[0.035]"
            : "border-transparent",
        ].join(" ")}
      >
        <div className="flex h-10 items-center">
          <Link
            href={PURCHASING_NAV.href ?? "/dashboard/purchasing"}
            onClick={onNavigate}
            className="group flex min-w-0 flex-1 items-center gap-3 px-3"
          >
            <Icon
              className={[
                "h-4 w-4 shrink-0",
                active
                  ? "text-td-accent-text"
                  : "text-td-muted group-hover:text-td-accent-text/80",
              ].join(" ")}
            />
            <span
              className={[
                "text-[13px] font-medium",
                active ? "text-td-primary" : "text-td-muted",
              ].join(" ")}
            >
              Purchasing
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={
              open
                ? "Collapse Purchasing"
                : "Expand Purchasing"
            }
            className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-td-muted transition hover:bg-td-ink/[0.035] hover:text-td-accent-text"
          >
            <ChevronDown
              className={[
                "h-3.5 w-3.5 transition-transform duration-200",
                open ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>
        </div>

        {open ? (
          <div className="border-t border-td-ink/[0.045] px-2 pb-2 pt-2">
            {PURCHASING_NAV.children.map((item) => {
              const childActive =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);
              const ChildIcon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={[
                    "group flex min-h-9 items-center gap-2.5 rounded-lg px-3 py-2 text-[11px] transition",
                    childActive
                      ? "bg-td-accent/[0.07] text-td-accent-text"
                      : "text-td-muted hover:bg-td-ink/[0.025] hover:text-td-secondary",
                  ].join(" ")}
                >
                  <ChildIcon
                    className={[
                      "h-3.5 w-3.5 shrink-0",
                      childActive
                        ? "text-td-accent-text"
                        : "text-td-muted group-hover:text-td-accent-text/70",
                    ].join(" ")}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NavGroup({
  label,
  items,
  collapsed,
  pathname,
  onNavigate,
}: {
  label?: string;
  items: ReadonlyArray<{
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
  collapsed: boolean;
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div>
      {label && !collapsed ? (
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-td-muted">
          {label}
        </p>
      ) : null}

      <div className="space-y-1">
        {items.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={[
                "group relative flex h-10 items-center overflow-hidden rounded-xl border transition duration-300",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                active
                  ? "border-td-accent/[0.18] bg-td-accent/[0.065] text-td-primary"
                  : "border-transparent text-td-muted hover:border-td-ink/[0.06] hover:bg-td-ink/[0.025] hover:text-td-primary",
              ].join(" ")}
            >
              {active ? (
                <span className="absolute inset-y-2 left-0 w-[2px] rounded-r-full bg-td-accent shadow-[0_0_10px_rgb(var(--td-accent-rgb)/0.8)]" />
              ) : null}

              <Icon
                className={[
                  "relative z-10 h-4 w-4 shrink-0",
                  active ? "text-td-accent-text" : "text-td-muted group-hover:text-td-accent-text/80",
                ].join(" ")}
              />

              {!collapsed ? (
                <span className="relative z-10 text-[13px] font-medium">
                  {item.label}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

