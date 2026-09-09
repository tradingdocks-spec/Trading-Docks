"use client";

import { Clock3, UserPlus, Users } from "lucide-react";

import { MetricCard } from "../common/MetricCard";
import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";

const employees = [
  ["Alex Morgan", "Fulfillment", "8:00 AM–4:00 PM", "38.0 hrs"],
  ["Morgan Lee", "Pricing & Listings", "10:00 AM–6:00 PM", "32.5 hrs"],
  ["Taylor Reed", "Tournament Operations", "4:00 PM–10:00 PM", "24.0 hrs"],
];

export function EmployeesWorkspace() {
  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Employee operations"
        title="Schedules, time cards, and team activity."
        description="Manage employee roles, weekly shifts, clock-in records, time-card approvals, and payroll readiness."
        icon={Users}
        actionLabel="Add employee"
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Employees" value="3" detail="2 active today" icon={Users} />
        <MetricCard label="Scheduled hours" value="94.5" detail="Current payroll period" icon={Clock3} />
        <MetricCard label="Time cards pending" value="2" detail="Require approval" icon={UserPlus} />
        <MetricCard label="Overtime risk" value="1" detail="Alex approaching 40 hours" icon={Clock3} />
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text">Team schedule</p>
            <h2 className="mt-2 text-lg font-semibold text-td-primary">Current week</h2>
          </div>
          <button className="rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.025] px-4 py-2 text-[11px] text-td-secondary">
            Approve time cards
          </button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-td-ink/[0.06] text-[11px] uppercase tracking-[0.16em] text-td-muted">
                <th className="px-3 py-3">Employee</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Today's shift</th>
                <th className="px-3 py-3">Period hours</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(([name, role, shift, hours]) => (
                <tr key={name} className="border-b border-td-ink/[0.045] text-xs text-td-secondary">
                  <td className="px-3 py-4 font-semibold text-td-primary">{name}</td>
                  <td className="px-3 py-4">{role}</td>
                  <td className="px-3 py-4">{shift}</td>
                  <td className="px-3 py-4">{hours}</td>
                  <td className="px-3 py-4"><span className="rounded-full bg-td-success/[0.06] px-2 py-1 text-[11px] text-td-success">Clocked in</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </WorkspaceFrame>
  );
}

