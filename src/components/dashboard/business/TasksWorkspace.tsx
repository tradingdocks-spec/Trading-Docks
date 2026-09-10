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
          <p className="py-10 text-center text-xs text-td-muted">No tasks have been created.</p>
        </div>
      </section>
    </WorkspaceFrame>
  );
}
