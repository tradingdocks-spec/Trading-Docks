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
        <MetricCard label="Upcoming events" value="4" detail="Next: Friday Night Magic" icon={CalendarDays} />
        <MetricCard label="Registered players" value="68" detail="Across upcoming events" icon={Users} />
        <MetricCard label="Open staff positions" value="2" detail="Judge and scorekeeper" icon={Users} />
        <MetricCard label="Prize support" value="$1,240" detail="Allocated this month" icon={Medal} />
      </div>

      <section className={`${styles.glassPanel} mt-5 rounded-[26px] p-5`}>
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            ["Friday Night Magic", "July 31 · 6:00 PM", "24 / 32 players"],
            ["Store Championship", "August 8 · 11:00 AM", "18 / 64 players"],
            ["Pokémon League", "August 12 · 5:30 PM", "14 / 24 players"],
            ["Commander Night", "August 14 · 6:00 PM", "12 pods planned"],
          ].map(([title, date, registration]) => (
            <div key={title} className="rounded-2xl border border-td-ink/[0.06] bg-black/[0.08] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-td-primary">{title}</p>
                  <p className="mt-2 text-[11px] text-td-muted">{date}</p>
                </div>
                <Trophy className="h-4 w-4 text-td-accent-text" />
              </div>
              <p className="mt-4 text-[11px] text-td-accent-text">{registration}</p>
            </div>
          ))}
        </div>
      </section>
    </WorkspaceFrame>
  );
}

