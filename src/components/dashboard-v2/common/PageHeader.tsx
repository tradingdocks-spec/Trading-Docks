import type { LucideIcon } from "lucide-react";
import { CircleDot, Plus } from "lucide-react";

import styles from "../styles.module.css";

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <header className={`${styles.glassPanel} rounded-[28px] p-5 sm:p-6`}>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-td-accent/[0.13] bg-td-accent/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.17em] text-td-accent-text">
            <Icon className="h-3.5 w-3.5 text-td-accent-text" />
            {eyebrow}
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-td-primary sm:text-4xl">
            {title}
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-td-muted">
            {description}
          </p>

          <div className="mt-4 flex items-center gap-4 text-[11px] text-td-muted">
            <span className="flex items-center gap-2">
              <CircleDot className="h-3 w-3 text-td-success" />
              Live workspace
            </span>
            <span>Saved locally</span>
          </div>
        </div>

        {actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-td-accent via-td-accent to-td-accent px-5 text-xs font-semibold text-td-on-accent shadow-[0_14px_32px_rgb(var(--td-accent-rgb)/0.2),inset_0_1px_0_rgb(var(--td-ink-rgb)/0.62)] transition hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" />
            {actionLabel}
          </button>
        ) : null}
      </div>
    </header>
  );
}

