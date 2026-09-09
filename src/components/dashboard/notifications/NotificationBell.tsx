"use client";

import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Trash2,
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
      return "text-td-success bg-td-success/10 border-td-success/20";

    case "success":
      return "text-td-accent-text bg-td-accent/10 border-td-accent/20";

    case "inventory":
      return "text-td-violet bg-td-violet/10 border-td-violet/20";

    case "warning":
      return "text-td-warning bg-td-warning/10 border-td-warning/20";

    case "error":
      return "text-td-danger bg-td-danger/10 border-td-danger/20";
  }
}

export function NotificationBell({ plan }: { plan: AccountTier }) {
  void plan;
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const ref = useRef<HTMLDivElement>(null);

  const unread = useMemo(
    () => notifications.filter((n) => n.unread).length,
    [notifications],
  );

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
        className="group relative flex h-10 w-10 items-center justify-center rounded-xl border border-td-ink/[0.08] bg-td-ink/[0.03] transition-all duration-200 hover:border-td-accent/20 hover:bg-td-accent/[0.04]"
      >
        <Bell className="h-4 w-4 text-td-secondary transition group-hover:text-td-accent-text" />

        {unread > 0 && (
          <>
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-td-accent" />

            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-td-accent px-1 text-[11px] font-semibold text-td-on-accent">
              {unread}
            </span>
          </>
        )}
      </button>

      <div
        className={`absolute right-0 top-[calc(100%+10px)] z-50 w-[390px] overflow-hidden rounded-2xl border border-td-ink/[0.08] bg-td-surface/98 shadow-[0_30px_90px_rgb(var(--td-shadow-rgb)/calc(0.55*var(--td-shadow-strength))),0_0_50px_rgb(var(--td-accent-rgb)/0.08)] backdrop-blur-2xl transition-all duration-200 ${
          open
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-td-ink/[0.06] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-td-primary">
              Notifications
            </p>

            <p className="mt-1 text-[11px] text-td-muted">
              Orders, inventory, sync, automation and system
              activity
            </p>
          </div>

          <div className="rounded-full border border-td-accent/20 bg-td-accent/10 px-2 py-1 text-[11px] font-semibold text-td-accent-text">
            {unread} New
          </div>
        </div>

        <div className="max-h-[430px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
              <CheckCircle2 className="h-7 w-7 text-td-accent-text/70" />
              <p className="mt-3 text-xs font-semibold text-td-primary">You&apos;re all caught up</p>
              <p className="mt-1 text-[11px] leading-5 text-td-muted">
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
                className="group flex gap-3 border-b border-td-ink/[0.05] px-5 py-4 transition hover:bg-td-ink/[0.025]"
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
                    <p className="text-[11px] font-semibold text-td-primary">
                      {notification.title}
                    </p>

                    <div className="flex items-center gap-2">
                      {notification.unread && (
                        <span className="h-2 w-2 rounded-full bg-td-accent" />
                      )}

                      <span className="text-[11px] text-td-muted">
                        {notification.time}
                      </span>
                    </div>
                  </div>

                  <p className="mt-1 text-[11px] leading-5 text-td-muted">
                    {notification.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-td-ink/[0.06] px-5 py-3">
          <div className="flex items-center gap-4">
            <button
              type="button"
              disabled={notifications.length === 0 || unread === 0}
              onClick={() => setNotifications((current) => current.map((item) => ({ ...item, unread: false })))}
              className="text-[11px] font-medium text-td-accent-text transition hover:text-td-accent-text disabled:cursor-not-allowed disabled:text-td-muted"
            >
              Mark all as read
            </button>

            {confirmClear ? (
              <span className="flex items-center gap-2 text-[11px]">
                <span className="text-td-muted">Clear everything?</span>
                <button
                  type="button"
                  onClick={() => {
                    setNotifications([]);
                    setConfirmClear(false);
                  }}
                  className="font-semibold text-td-danger transition hover:text-td-danger"
                >
                  Yes, clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="text-td-secondary transition hover:text-td-primary"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                disabled={notifications.length === 0}
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-td-muted transition hover:text-td-danger disabled:cursor-not-allowed disabled:text-td-muted"
              >
                <Trash2 className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>

          <Link
            href="/dashboard?panel=notifications"
            className="flex items-center gap-1 text-[11px] font-medium text-td-secondary transition hover:text-td-primary"
          >
            View All

            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
