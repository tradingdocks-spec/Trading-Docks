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
    <header className={`${styles.glassPanel} rounded-[28px] p-4 sm:p-6`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.13] bg-cyan-400/[0.04] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.17em] text-cyan-200">
            <Icon className="h-3.5 w-3.5 text-cyan-300" />
            {eyebrow}
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:mt-4 sm:text-4xl">
            {title}
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:mt-3 sm:leading-7">
            {description}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-slate-600 sm:mt-4">
            <span className="flex items-center gap-2">
              <CircleDot className="h-3 w-3 text-emerald-300" />
              Connected workspace
            </span>
            <span>Secure cloud save</span>
          </div>
        </div>

        {actionLabel && onAction ? (
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
