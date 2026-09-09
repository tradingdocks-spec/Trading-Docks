"use client";

import {
  BadgeDollarSign,
  Boxes,
  CircleDollarSign,
  Landmark,
  LineChart,
  ReceiptText,
} from "lucide-react";

import { MetricCard } from "../common/MetricCard";
import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";

export function ReportsWorkspace() {
  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Reports and analytics"
        title="Turn account activity into clear reports."
        description="Revenue, inventory, expenses, taxes, payroll, marketplace, and operating reports will populate from this account's records."
        icon={LineChart}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Revenue" value="$0" detail="No sales recorded" icon={CircleDollarSign} />
        <MetricCard label="Net profit" value="$0" detail="No financial activity" icon={BadgeDollarSign} />
        <MetricCard label="Expenses" value="$0" detail="No expenses recorded" icon={ReceiptText} />
        <MetricCard label="Sales tax owed" value="$0" detail="No taxable sales" icon={Landmark} />
        <MetricCard label="Inventory value" value="$0" detail="No inventory added" icon={Boxes} />
        <MetricCard label="Profit margin" value="0%" detail="No sales to calculate" icon={LineChart} />
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-8 text-center`}>
        <LineChart className="mx-auto h-8 w-8 text-td-accent-text/70" />
        <h2 className="mt-4 text-lg font-semibold text-td-primary">No report data yet</h2>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-td-muted">
          Reports will appear after this account records inventory, purchases,
          sales, expenses, payouts, employees, or other business activity.
        </p>
      </section>
    </WorkspaceFrame>
  );
}
