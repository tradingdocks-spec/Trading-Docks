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
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {label}
          </p>
          <p className="mt-2.5 text-2xl font-semibold tracking-[-0.03em] text-white">
            {value}
          </p>
          <p className="mt-1.5 text-[0.8rem] leading-5 text-slate-500">{detail}</p>
        </div>

        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/[0.12] bg-cyan-400/[0.045] text-cyan-300">
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
    </article>
  );
}
