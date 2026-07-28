"use client";

import { Clock3, UserPlus, Users } from "lucide-react";

import { MetricCard } from "../common/MetricCard";
import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";

const employees: string[][] = [];

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
        <MetricCard label="Employees" value="0" detail="No employees added" icon={Users} />
        <MetricCard label="Scheduled hours" value="0" detail="No shifts scheduled" icon={Clock3} />
        <MetricCard label="Time cards pending" value="0" detail="Nothing awaiting approval" icon={UserPlus} />
        <MetricCard label="Overtime risk" value="0" detail="No overtime risk" icon={Clock3} />
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Team schedule</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Current week</h2>
          </div>
          <button className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2 text-[10px] text-slate-400">
            Approve time cards
          </button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-white/[0.06] text-[8px] uppercase tracking-[0.16em] text-slate-700">
                <th className="px-3 py-3">Employee</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Today's shift</th>
                <th className="px-3 py-3">Period hours</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(([name, role, shift, hours]) => (
                <tr key={name} className="border-b border-white/[0.045] text-xs text-slate-400">
                  <td className="px-3 py-4 font-semibold text-slate-200">{name}</td>
                  <td className="px-3 py-4">{role}</td>
                  <td className="px-3 py-4">{shift}</td>
                  <td className="px-3 py-4">{hours}</td>
                  <td className="px-3 py-4"><span className="rounded-full bg-emerald-400/[0.06] px-2 py-1 text-[8px] text-emerald-300">Clocked in</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {employees.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-600">No employees have been added to this account.</p>
          ) : null}
        </div>
      </section>
    </WorkspaceFrame>
  );
}
