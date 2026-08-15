"use client";

import { CheckCircle2, ClipboardList, Clock3, Users } from "lucide-react";

import { MetricCard } from "../common/MetricCard";
import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";

export function TasksWorkspace() {
  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Operations tasks"
        title="Turn business activities into accountable work."
        description="Assign inventory, fulfillment, vendor, staffing, and event tasks with deadlines and clear ownership."
        icon={ClipboardList}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Open tasks" value="0" detail="No open tasks" icon={ClipboardList} />
        <MetricCard label="Completed today" value="0" detail="No tasks completed" icon={CheckCircle2} />
        <MetricCard label="Overdue" value="0" detail="Nothing overdue" icon={Clock3} />
        <MetricCard label="Assigned staff" value="0" detail="No staff assigned" icon={Users} />
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
        <div className="space-y-3">
          {([] as string[][]).map(([title, owner, due]) => (
            <div key={title} className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-black/[0.08] p-4">
              <button className="h-5 w-5 rounded-full border border-white/[0.12] bg-white/[0.02]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-200">{title}</p>
                <p className="mt-1 text-[9px] text-slate-600">Assigned to {owner}</p>
              </div>
              <span className="text-[9px] text-cyan-300">{due}</span>
            </div>
          ))}
          <p className="py-10 text-center text-xs text-slate-600">No tasks have been created.</p>
        </div>
      </section>
    </WorkspaceFrame>
  );
}
