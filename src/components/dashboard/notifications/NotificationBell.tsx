"use client";

import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Trash2,
  DollarSign,
  Package,
  ShoppingCart,
  TriangleAlert,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AccountTier } from "@/lib/plan-entitlements";

type NotificationType =
  | "success"
  | "warning"
  | "error"
  | "sale"
  | "inventory";

type Notification = {
  id: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  type: NotificationType;
  href: string;
};

const seedNotifications: Notification[] = [
  {
    id: "1",
    title: "New Marketplace Sale",
    description: "A TCGplayer order has been received.",
    time: "2m ago",
    unread: true,
    type: "sale",
    href: "/dashboard/orders",
  },
  {
    id: "2",
    title: "Inventory Import Complete",
    description: "4,532 cards imported successfully.",
    time: "12m ago",
    unread: true,
    type: "success",
    href: "/dashboard/inventory",
  },
  {
    id: "3",
    title: "Price Sync Finished",
    description: "TCGplayer pricing updated.",
    time: "28m ago",
    unread: false,
    type: "inventory",
    href: "/dashboard/automation",
  },
  {
    id: "4",
    title: "eBay Listing Failed",
    description: "12 listings require attention.",
    time: "1h ago",
    unread: true,
    type: "error",
    href: "/dashboard/marketplaces",
  },
  {
    id: "5",
    title: "Automation Complete",
    description: "Nightly sync completed successfully.",
    time: "3h ago",
    unread: false,
    type: "success",
    href: "/dashboard/automation",
  },
];

const DISMISSED_NOTIFICATIONS_KEY = "trading-docks-dismissed-notifications-v1";

function icon(type: NotificationType) {
  switch (type) {
    case "sale":
      return ShoppingCart;

    case "success":
      return CheckCircle2;

    case "inventory":
      return Package;

    case "warning":
      return TriangleAlert;

    case "error":
      return XCircle;

    default:
      return UploadCloud;
  }
}

function color(type: NotificationType) {
  switch (type) {
    case "sale":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

    case "success":
      return "text-cyan-300 bg-cyan-500/10 border-cyan-500/20";

    case "inventory":
      return "text-indigo-300 bg-indigo-500/10 border-indigo-500/20";

    case "warning":
      return "text-amber-300 bg-amber-500/10 border-amber-500/20";

    case "error":
      return "text-red-300 bg-red-500/10 border-red-500/20";
  }
}

export function NotificationBell({ plan }: { plan: AccountTier }) {
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(() =>
    seedNotifications.filter((notification) => {
      if (plan === "business") return true;
      if (plan === "seller") return notification.href !== "/dashboard/automation";
      return notification.type === "inventory" || notification.type === "success";
    }),
  );

  const ref = useRef<HTMLDivElement>(null);

  const unread = useMemo(
    () => notifications.filter((n) => n.unread).length,
    [notifications],
  );

  useEffect(() => {
    try {
      const dismissed = new Set<string>(
        JSON.parse(window.localStorage.getItem(DISMISSED_NOTIFICATIONS_KEY) ?? "[]"),
      );
      if (dismissed.size > 0) {
        setNotifications((current) => current.filter((item) => !dismissed.has(item.id)));
      }
    } catch {
      window.localStorage.removeItem(DISMISSED_NOTIFICATIONS_KEY);
    }
  }, []);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", outside);

    return () =>
      document.removeEventListener(
        "mousedown",
        outside,
      );
  }, []);

  return (
    <div
      ref={ref}
      className="relative"
    >
      <button
        onClick={() => {
          setOpen(!open);
          setConfirmClear(false);
        }}
        className="group relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] transition-all duration-200 hover:border-cyan-400/20 hover:bg-cyan-400/[0.04]"
      >
        <Bell className="h-4 w-4 text-slate-400 transition group-hover:text-cyan-300" />

        {unread > 0 && (
          <>
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-cyan-400" />

            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-cyan-400 px-1 text-[9px] font-semibold text-slate-900">
              {unread}
            </span>
          </>
        )}
      </button>

      <div
        className={`absolute right-0 top-[calc(100%+10px)] z-50 w-[390px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071017]/98 shadow-[0_30px_90px_rgba(0,0,0,0.55),0_0_50px_rgba(34,211,238,0.08)] backdrop-blur-2xl transition-all duration-200 ${
          open
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-white">
              Notifications
            </p>

            <p className="mt-1 text-[10px] text-slate-500">
              Orders, inventory, sync, automation and system
              activity
            </p>
          </div>

          <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[9px] font-semibold text-cyan-300">
            {unread} New
          </div>
        </div>

        <div className="max-h-[430px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
              <CheckCircle2 className="h-7 w-7 text-cyan-300/70" />
              <p className="mt-3 text-xs font-semibold text-white">You&apos;re all caught up</p>
              <p className="mt-1 text-[10px] leading-5 text-slate-500">
                New account and workspace activity will appear here.
              </p>
            </div>
          ) : null}
          {notifications.map((notification) => {
            const Icon = icon(notification.type);

            return (
              <Link
                key={notification.id}
                href={notification.href}
                onClick={() => {
                  setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, unread: false } : item));
                  setOpen(false);
                }}
                className="group flex gap-3 border-b border-white/[0.05] px-5 py-4 transition hover:bg-white/[0.025]"
              >
                <div
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${color(
                    notification.type,
                  )}`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold text-white">
                      {notification.title}
                    </p>

                    <div className="flex items-center gap-2">
                      {notification.unread && (
                        <span className="h-2 w-2 rounded-full bg-cyan-400" />
                      )}

                      <span className="text-[9px] text-slate-500">
                        {notification.time}
                      </span>
                    </div>
                  </div>

                  <p className="mt-1 text-[10px] leading-5 text-slate-500">
                    {notification.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3">
          <div className="flex items-center gap-4">
            <button
              type="button"
              disabled={notifications.length === 0 || unread === 0}
              onClick={() => setNotifications((current) => current.map((item) => ({ ...item, unread: false })))}
              className="text-[10px] font-medium text-cyan-300 transition hover:text-cyan-200 disabled:cursor-not-allowed disabled:text-slate-700"
            >
              Mark all as read
            </button>

            {confirmClear ? (
              <span className="flex items-center gap-2 text-[10px]">
                <span className="text-slate-500">Clear everything?</span>
                <button
                  type="button"
                  onClick={() => {
                    const dismissed = seedNotifications.map((item) => item.id);
                    window.localStorage.setItem(
                      DISMISSED_NOTIFICATIONS_KEY,
                      JSON.stringify(dismissed),
                    );
                    setNotifications([]);
                    setConfirmClear(false);
                  }}
                  className="font-semibold text-red-300 transition hover:text-red-200"
                >
                  Yes, clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="text-slate-400 transition hover:text-white"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                disabled={notifications.length === 0}
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 transition hover:text-red-300 disabled:cursor-not-allowed disabled:text-slate-700"
              >
                <Trash2 className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>

          <Link
            href="/dashboard?panel=notifications"
            className="flex items-center gap-1 text-[10px] font-medium text-slate-400 transition hover:text-white"
          >
            View All

            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
