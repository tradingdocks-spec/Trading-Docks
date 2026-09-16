"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

type SidebarItemProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
  badge?: string | number;
  exact?: boolean;
  onNavigate?: () => void;
};

export function SidebarItem({
  href,
  label,
  icon: Icon,
  collapsed,
  badge,
  exact = false,
  onNavigate,
}: SidebarItemProps) {
  const pathname = usePathname();

  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
      className={[
        "group relative flex h-10 items-center rounded-xl border text-sm transition-all duration-200",
        collapsed
          ? "mx-auto w-10 justify-center px-0"
          : "w-full gap-3 px-3",
        isActive
          ? "border-td-accent/[0.12] bg-td-accent/[0.075] text-td-primary shadow-[0_0_26px_rgb(var(--td-accent-rgb)/0.045)]"
          : "border-transparent text-td-muted hover:border-td-ink/[0.05] hover:bg-td-ink/[0.035] hover:text-td-primary",
      ].join(" ")}
    >
      {isActive ? (
        <span className="absolute -left-px top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-td-accent shadow-[0_0_12px_rgb(var(--td-accent-rgb)/0.8)]" />
      ) : null}

      <Icon
        aria-hidden="true"
        className={[
          "h-[17px] w-[17px] shrink-0 transition-colors",
          isActive
            ? "text-td-accent-text"
            : "text-td-muted group-hover:text-td-secondary",
        ].join(" ")}
      />

      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">
            {label}
          </span>

          {badge !== undefined ? (
            <span className="rounded-md border border-td-ink/[0.06] bg-td-ink/[0.04] px-1.5 py-0.5 text-[11px] font-medium text-td-muted">
              {badge}
            </span>
          ) : null}
        </>
      ) : null}

      {collapsed ? (
        <span className="pointer-events-none absolute left-[calc(100%+12px)] z-50 whitespace-nowrap rounded-lg border border-td-ink/[0.08] bg-td-surface px-2.5 py-1.5 text-xs font-medium text-td-primary opacity-0 shadow-2xl transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100">
          {label}
        </span>
      ) : null}
    </Link>
  );
}