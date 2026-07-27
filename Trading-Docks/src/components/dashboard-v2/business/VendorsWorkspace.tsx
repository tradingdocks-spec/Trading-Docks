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
        actionLabel="Add vendor"
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active vendors" value="8" detail="3 preferred suppliers" icon={Truck} />
        <MetricCard label="Open purchase orders" value="6" detail="$4,821 committed" icon={PackageCheck} />
        <MetricCard label="Deliveries this week" value="4" detail="1 arriving today" icon={Truck} />
        <MetricCard label="Average payment terms" value="Net 21" detail="Across active vendors" icon={WalletCards} />
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
        <div className="grid gap-3 lg:grid-cols-3">
          {[
            ["Cardboard Gold", "Top loaders, sleeves, storage", "Net 30"],
            ["Southern Hobby", "Sealed TCG products", "Prepaid"],
            ["USPS Supplies", "Labels and shipping materials", "No charge"],
          ].map(([name, category, terms]) => (
            <div key={name} className="rounded-2xl border border-white/[0.06] bg-black/[0.08] p-4">
              <p className="text-sm font-semibold text-white">{name}</p>
              <p className="mt-2 text-[10px] text-slate-500">{category}</p>
              <p className="mt-4 text-[9px] text-cyan-300">{terms}</p>
            </div>
          ))}
        </div>
      </section>
    </WorkspaceFrame>
  );
}

