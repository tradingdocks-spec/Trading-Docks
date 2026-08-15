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
          {([] as Array<[string, string, number, string]>).map(([name, remaining, level, recommendation]) => (
            <div key={name as string} className="rounded-2xl border border-white/[0.06] bg-black/[0.08] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-200">{name as string}</p>
                  <p className="mt-1 text-[9px] text-slate-600">{remaining as string}</p>
                </div>
                <span className="text-[9px] font-semibold text-cyan-300">{recommendation as string}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300" style={{ width: `${level}%` }} />
              </div>
            </div>
          ))}
          <p className="py-10 text-center text-xs text-slate-600">No supply items have been added.</p>
        </div>
      </section>
    </WorkspaceFrame>
  );
}
