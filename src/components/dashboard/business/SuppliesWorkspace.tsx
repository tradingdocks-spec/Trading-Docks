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
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Supply items" value="0" detail="No supplies tracked" icon={Boxes} />
        <MetricCard label="Low stock" value="0" detail="No reorder alerts" icon={AlertTriangle} />
        <MetricCard label="Open orders" value="0" detail="$0 committed" icon={PackageCheck} />
        <MetricCard label="Next delivery" value="None" detail="No deliveries scheduled" icon={Truck} />
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
        <div className="space-y-3">
          <p className="py-10 text-center text-xs text-td-muted">No supply items have been added.</p>
        </div>
      </section>
    </WorkspaceFrame>
  );
}
