import type { LucideIcon } from "lucide-react";

import styles from "../styles.module.css";

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <article className={`${styles.glassPanel} ${styles.metricCard} rounded-[22px] p-5`}>
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-slate-600">
            {label}
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white">
            {value}
          </p>
          <p className="mt-2 text-xs text-slate-600">{detail}</p>
        </div>

        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/[0.12] bg-cyan-400/[0.05] text-cyan-300">
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
    </article>
  );
}

