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
          <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-td-muted">
            {label}
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-td-primary">
            {value}
          </p>
          <p className="mt-2 text-xs text-td-muted">{detail}</p>
        </div>

        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-td-accent/[0.12] bg-td-accent/[0.05] text-td-accent-text">
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
    </article>
  );
}

