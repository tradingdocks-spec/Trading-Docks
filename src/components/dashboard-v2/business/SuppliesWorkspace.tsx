"use client";

import { AlertTriangle, Boxes, PackageCheck, Truck } from "lucide-react";

import { MetricCard } from "../common/MetricCard";
import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";

export function SuppliesWorkspace() {
  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Supply ordering"
        title="Know what to reorder before it runs out."
        description="Track on-hand quantities, reorder points, vendor lead time, open purchase orders, and expected deliveries."
        icon={PackageCheck}
        actionLabel="Create purchase order"
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Supply items" value="26" detail="Across shipping and storage" icon={Boxes} />
        <MetricCard label="Low stock" value="4" detail="Reorder recommended" icon={AlertTriangle} />
        <MetricCard label="Open orders" value="6" detail="$4,821 committed" icon={PackageCheck} />
        <MetricCard label="Next delivery" value="Tomorrow" detail="USPS supplies" icon={Truck} />
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
        <div className="space-y-3">
          {[
            ["#000 Bubble Mailers", "82 remaining", 18, "Reorder 500"],
            ["4×6 Shipping Labels", "640 remaining", 42, "Reorder 2,000"],
            ["Penny Sleeves", "3,200 remaining", 68, "Healthy"],
            ["Top Loaders", "410 remaining", 28, "Reorder 1,000"],
          ].map(([name, remaining, level, recommendation]) => (
            <div key={name as string} className="rounded-2xl border border-td-ink/[0.06] bg-black/[0.08] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-td-primary">{name as string}</p>
                  <p className="mt-1 text-[11px] text-td-muted">{remaining as string}</p>
                </div>
                <span className="text-[11px] font-semibold text-td-accent-text">{recommendation as string}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-td-ink/[0.04]">
                <div className="h-full rounded-full bg-gradient-to-r from-td-accent to-td-accent" style={{ width: `${level}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </WorkspaceFrame>
  );
}

