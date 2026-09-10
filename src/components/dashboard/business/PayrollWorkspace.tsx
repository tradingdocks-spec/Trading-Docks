"use client";

import { CircleDollarSign, Clock3, CreditCard, FileCheck2 } from "lucide-react";

import { MetricCard } from "../common/MetricCard";
import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";

export function PayrollWorkspace() {
  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Payroll operations"
        title="Approve time, calculate payroll, and export."
        description="Review employee hours, overtime, deductions, and payroll readiness before sending approved records to your payroll provider."
        icon={CreditCard}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Gross payroll" value="$0" detail="No payroll activity" icon={CircleDollarSign} />
        <MetricCard label="Approved hours" value="0" detail="No hours recorded" icon={Clock3} />
        <MetricCard label="Overtime" value="0" detail="No overtime recorded" icon={Clock3} />
        <MetricCard label="Payroll status" value="Not set up" detail="Add employees to begin" icon={FileCheck2} />
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text">Payroll workflow</p>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            ["1", "Add employees", "No employees yet"],
            ["2", "Collect time cards", "No time cards yet"],
            ["3", "Approve payroll", "Nothing awaiting review"],
            ["4", "Export provider file", "No payroll to export"],
          ].map(([step, title, detail]) => (
            <div key={step} className="rounded-2xl border border-td-ink/[0.06] bg-black/[0.08] p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-td-accent/[0.06] text-[11px] font-semibold text-td-accent-text">{step}</span>
              <p className="mt-4 text-xs font-semibold text-td-primary">{title}</p>
              <p className="mt-1 text-[11px] text-td-muted">{detail}</p>
            </div>
          ))}
        </div>
      </section>
    </WorkspaceFrame>
  );
}
