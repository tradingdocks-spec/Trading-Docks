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
    <article className={`${styles.glassPanel} ${styles.metricCard} rounded-[18px] p-4 sm:p-5`}>
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-td-muted">
            {label}
          </p>
          <p className="mt-2.5 text-2xl font-semibold tracking-[-0.03em] text-td-primary">
            {value}
          </p>
          <p className="mt-1.5 text-[0.8rem] leading-5 text-td-muted">{detail}</p>
        </div>

        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-td-accent/[0.12] bg-td-accent/[0.045] text-td-accent-text">
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
    </article>
  );
}
