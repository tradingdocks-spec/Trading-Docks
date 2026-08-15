"use client";

import { PackageCheck, Truck, WalletCards } from "lucide-react";

import { MetricCard } from "../common/MetricCard";
import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";

export function VendorsWorkspace() {
  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Vendor management"
        title="Suppliers, distributors, and delivery relationships."
        description="Track vendor contacts, open purchase orders, delivery performance, terms, and product availability."
        icon={Truck}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active vendors" value="0" detail="No vendors added" icon={Truck} />
        <MetricCard label="Open purchase orders" value="0" detail="$0 committed" icon={PackageCheck} />
        <MetricCard label="Deliveries this week" value="0" detail="No deliveries expected" icon={Truck} />
        <MetricCard label="Average payment terms" value="—" detail="No terms available" icon={WalletCards} />
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
        <div className="grid gap-3 lg:grid-cols-3">
          <p className="col-span-full py-10 text-center text-xs text-slate-600">No vendors have been added.</p>
        </div>
      </section>
    </WorkspaceFrame>
  );
}
