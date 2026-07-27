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
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.13] bg-cyan-400/[0.04] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.17em] text-cyan-200">
            <Icon className="h-3.5 w-3.5 text-cyan-300" />
            {eyebrow}
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
            {title}
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
            {description}
          </p>

          <div className="mt-4 flex items-center gap-4 text-[10px] text-slate-600">
            <span className="flex items-center gap-2">
              <CircleDot className="h-3 w-3 text-emerald-300" />
              Live workspace
            </span>
            <span>Saved locally</span>
          </div>
        </div>

        {actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-cyan-300 via-cyan-400 to-sky-500 px-5 text-xs font-semibold text-[#001018] shadow-[0_14px_32px_rgba(6,182,212,0.2),inset_0_1px_0_rgba(255,255,255,0.62)] transition hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" />
            {actionLabel}
          </button>
        ) : null}
      </div>
    </header>
  );
}

