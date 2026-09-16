import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CircleHelp } from "lucide-react";

export function FeatureIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-td-accent/[.12] bg-td-accent/[.025] px-5 py-4 sm:px-6" aria-labelledby="feature-intro-title">
      {eyebrow ? <p className="text-[10px] font-bold uppercase tracking-[.18em] text-td-accent-text">{eyebrow}</p> : null}
      <h2 id="feature-intro-title" className="mt-1 text-base font-semibold text-td-primary">{title}</h2>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-td-secondary">{description}</p>
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

export function WorkflowSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-2 text-[11px] text-td-secondary sm:flex-row sm:flex-wrap sm:items-center sm:gap-0" aria-label="Workflow steps">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-2 sm:flex-1">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-td-accent/20 bg-td-accent/[.08] text-[10px] font-bold text-td-accent-text">{index + 1}</span>
          <span className="font-medium">{step}</span>
          {index < steps.length - 1 ? <ArrowRight className="mx-2 hidden h-3.5 w-3.5 shrink-0 text-td-muted sm:block" aria-hidden="true" /> : null}
        </li>
      ))}
    </ol>
  );
}

export function ContextHelp({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-td-ink/[.07] bg-black/[.08] px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-semibold text-td-secondary outline-none focus-visible:ring-2 focus-visible:ring-td-accent/50 [&::-webkit-details-marker]:hidden">
        <CircleHelp className="h-3.5 w-3.5 text-td-accent-text" aria-hidden="true" />
        {label}
      </summary>
      <div className="pt-2 text-[11px] leading-5 text-td-muted">{children}</div>
    </details>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-td-ink/[.09] px-5 py-8 text-center">
      <p className="text-sm font-semibold text-td-primary">{title}</p>
      <p className="mt-1 max-w-md text-xs leading-5 text-td-muted">{description}</p>
      {action ? <Link href={action.href} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-td-accent px-4 text-xs font-bold text-td-on-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-td-accent/60">{action.label}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link> : null}
    </div>
  );
}
