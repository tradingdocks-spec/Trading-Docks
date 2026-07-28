"use client";

import { CalendarDays, Medal, Trophy, Users } from "lucide-react";

import { MetricCard } from "../common/MetricCard";
import { PageHeader } from "../common/PageHeader";
import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";

export function TournamentsWorkspace() {
  return (
    <WorkspaceFrame>
      <PageHeader
        eyebrow="Tournament operations"
        title="Registration, staffing, rounds, and brackets."
        description="Organize store events, player registration, table assignments, judges, pairings, brackets, and prize support."
        icon={Trophy}
        actionLabel="Create tournament"
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Upcoming events" value="0" detail="No events scheduled" icon={CalendarDays} />
        <MetricCard label="Registered players" value="0" detail="No registrations" icon={Users} />
        <MetricCard label="Open staff positions" value="0" detail="No staffing needs" icon={Users} />
        <MetricCard label="Prize support" value="$0" detail="Nothing allocated" icon={Medal} />
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
        <div className="grid gap-4 lg:grid-cols-2">
          {([] as string[][]).map(([title, date, registration]) => (
            <div key={title} className="rounded-2xl border border-white/[0.06] bg-black/[0.08] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-2 text-[10px] text-slate-500">{date}</p>
                </div>
                <Trophy className="h-4 w-4 text-cyan-300" />
              </div>
              <p className="mt-4 text-[9px] text-cyan-300">{registration}</p>
            </div>
          ))}
          <p className="col-span-full py-10 text-center text-xs text-slate-600">No tournaments have been created.</p>
        </div>
      </section>
    </WorkspaceFrame>
  );
}
