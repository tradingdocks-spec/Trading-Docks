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
        actionLabel="Create task"
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Open tasks" value="18" detail="6 due today" icon={ClipboardList} />
        <MetricCard label="Completed today" value="12" detail="80% on time" icon={CheckCircle2} />
        <MetricCard label="Overdue" value="3" detail="Requires attention" icon={Clock3} />
        <MetricCard label="Assigned staff" value="3" detail="All team members" icon={Users} />
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
        <div className="space-y-3">
          {[
            ["Pack 14 marketplace orders", "Alex", "Today · 2:00 PM"],
            ["Photograph 38 listing-queue cards", "Morgan", "Today · 5:00 PM"],
            ["Review vendor reorder recommendations", "Jeremy", "Tomorrow"],
            ["Prepare Store Championship prize support", "Taylor", "August 6"],
          ].map(([title, owner, due]) => (
            <div key={title} className="flex items-center gap-4 rounded-2xl border border-td-ink/[0.06] bg-black/[0.08] p-4">
              <button className="h-5 w-5 rounded-full border border-td-ink/[0.12] bg-td-ink/[0.02]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-td-primary">{title}</p>
                <p className="mt-1 text-[11px] text-td-muted">Assigned to {owner}</p>
              </div>
              <span className="text-[11px] text-td-accent-text">{due}</span>
            </div>
          ))}
        </div>
      </section>
    </WorkspaceFrame>
  );
}

