"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import type {
  NavigationGroup,
  NavigationItem,
} from "@/components/dashboard/navigation/navigation";

type SidebarGroupProps = {
  group: NavigationGroup;
  collapsed: boolean;
  expandedItems: string[];
  onToggleItem: (title: string) => void;
};

export function SidebarGroup({
  group,
  collapsed,
  expandedItems,
  onToggleItem,
}: SidebarGroupProps) {
  return (
    <section>
      {!collapsed && group.title ? (
        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-td-muted">
          {group.title}
        </p>
      ) : null}

      <div className="space-y-1">
        {group.items.map((item) => (
          <SidebarNavigationItem
            key={item.title}
            item={item}
            collapsed={collapsed}
            expanded={expandedItems.includes(item.title)}
            onToggle={() => onToggleItem(item.title)}
          />
        ))}
      </div>
    </section>
  );
}

function SidebarNavigationItem({
  item,
  collapsed,
  expanded,
  onToggle,
}: {
  item: NavigationItem;
  collapsed: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const Icon = item.icon;
  const target = item.href ?? item.children?.[0]?.href;
  const isActive =
    Boolean(target) &&
    (pathname === target || pathname.startsWith(`${target}/`));
  const hasChildren = Boolean(item.children?.length);

  const content = (
    <>
      <Icon className={isActive ? "h-4 w-4 text-td-accent-text" : "h-4 w-4"} />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
          {item.badge ? (
            <span className="rounded bg-td-ink/[0.05] px-1.5 py-0.5 text-[11px]">
              {item.badge}
            </span>
          ) : null}
          {hasChildren ? (
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            />
          ) : null}
        </>
      ) : null}
    </>
  );

  const className = `flex min-h-10 w-full items-center rounded-xl text-[11px] transition ${
    collapsed ? "justify-center px-0" : "gap-3 px-3"
  } ${
    isActive
      ? "bg-td-accent/[0.07] text-td-primary"
      : "text-td-muted hover:bg-td-ink/[0.035] hover:text-td-primary"
  }`;

  return (
    <div>
      {hasChildren && !collapsed ? (
        <button type="button" onClick={onToggle} className={className}>
          {content}
        </button>
      ) : target ? (
        <Link href={target} title={collapsed ? item.title : undefined} className={className}>
          {content}
        </Link>
      ) : (
        <button type="button" className={className} disabled>
          {content}
        </button>
      )}

      {hasChildren && expanded && !collapsed ? (
        <div className="ml-7 mt-1 space-y-1 border-l border-td-ink/[0.06] pl-3">
          {item.children?.map((child) => {
            const childActive =
              pathname === child.href || pathname.startsWith(`${child.href}/`);

            return (
              <Link
                key={child.href}
                href={child.href}
                className={`flex min-h-8 items-center rounded-lg px-2 text-[11px] transition ${
                  childActive
                    ? "bg-td-accent/[0.06] text-td-accent-text"
                    : "text-td-muted hover:bg-td-ink/[0.03] hover:text-td-secondary"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{child.title}</span>
                {child.badge ? (
                  <span className="ml-2 text-[11px] text-td-muted">
                    {child.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
