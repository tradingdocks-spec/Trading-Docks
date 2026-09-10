"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import {
  normalizeAccountTier,
} from "@/lib/tier-access";
import {
  canShowRoute,
  clientAccessFromTier,
  type ClientSafePlatformAccess,
} from "@/lib/platform/client-access";
import {
  requiredMembershipLabelForRoute,
  routeAccessLabel,
} from "@/lib/platform/route-access";

export function PlanAccessGate({
  accountType,
  clientAccess,
  children,
}: {
  accountType: string;
  clientAccess?: ClientSafePlatformAccess;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const plan = normalizeAccountTier(accountType);
  const access = clientAccess ?? clientAccessFromTier(plan);

  if (canShowRoute(access, pathname, process.env.NODE_ENV)) return children;

  const requiredPlan = requiredMembershipLabelForRoute(pathname) ?? "Required";
  const featureName = routeAccessLabel(pathname);

  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center px-5 py-10">
      <section className="w-full max-w-4xl rounded-[30px] border border-td-accent/[0.14] bg-td-surface/90 px-6 py-12 text-center shadow-[0_30px_100px_rgb(var(--td-shadow-rgb)/calc(0.35*var(--td-shadow-strength)))] sm:px-12">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-td-accent/25 bg-td-accent/[0.07] text-td-accent-text">
          <LockKeyhole className="h-6 w-6" />
        </span>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.2em] text-td-accent-text">
          {requiredPlan} plan or higher
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-td-primary">
          {featureName} is not included on your {plan === "store" ? "Store" : plan.charAt(0).toUpperCase() + plan.slice(1)} plan
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-td-muted">
          Upgrade to unlock this workspace and the additional tools included with the {requiredPlan} plan.
        </p>
        <Link
          href="/dashboard/plans"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-b from-td-accent to-td-accent px-6 text-xs font-bold text-td-on-accent shadow-[0_14px_34px_rgb(var(--td-accent-rgb)/0.2)]"
        >
          Compare plans
        </Link>
      </section>
    </div>
  );
}
