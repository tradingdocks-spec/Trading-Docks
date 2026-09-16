import type { ReactNode } from "react";

type PanelHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
};

export function PanelHeader({
  title,
  subtitle,
  eyebrow,
  action,
  className = "",
}: PanelHeaderProps) {
  return (
    <header
      className={[
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      ].join(" ")}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text/80">
            {eyebrow}
          </p>
        ) : null}

        <h2 className="text-base font-semibold tracking-tight text-td-primary">
          {title}
        </h2>

        {subtitle ? (
          <p className="mt-1 text-sm leading-5 text-td-muted">
            {subtitle}
          </p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}