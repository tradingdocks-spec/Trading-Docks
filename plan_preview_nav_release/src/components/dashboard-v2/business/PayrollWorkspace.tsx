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
        actionLabel="Run payroll review"
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Gross payroll" value="$4,862" detail="Current period estimate" icon={CircleDollarSign} />
        <MetricCard label="Approved hours" value="86.5" detail="8.0 hours pending" icon={Clock3} />
        <MetricCard label="Overtime" value="2.0" detail="1 employee affected" icon={Clock3} />
        <MetricCard label="Payroll status" value="Draft" detail="Next run July 31" icon={FileCheck2} />
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Payroll workflow</p>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            ["1", "Collect time cards", "3 employees"],
            ["2", "Review exceptions", "2 items"],
            ["3", "Approve payroll", "Awaiting review"],
            ["4", "Export provider file", "Not started"],
          ].map(([step, title, detail]) => (
            <div key={step} className="rounded-2xl border border-white/[0.06] bg-black/[0.08] p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/[0.06] text-[10px] font-semibold text-cyan-300">{step}</span>
              <p className="mt-4 text-xs font-semibold text-slate-200">{title}</p>
              <p className="mt-1 text-[9px] text-slate-600">{detail}</p>
            </div>
          ))}
        </div>
      </section>
    </WorkspaceFrame>
  );
}

