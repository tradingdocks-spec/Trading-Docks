import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";

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
    <header className={`${styles.glassPanel} rounded-[20px] p-4 sm:p-5`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="td-kicker inline-flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-[var(--td-information)]" />
            {eyebrow}
          </div>

          <h1 className="td-title mt-3">
            {title}
          </h1>

          <p className="td-body mt-2 max-w-3xl">
            {description}
          </p>
        </div>

        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="td-button-primary px-5"
          >
            <Plus className="h-4 w-4" />
            {actionLabel}
          </button>
        ) : null}
      </div>
    </header>
  );
}
