import { Database, KeyRound, Layers3, ShieldCheck, Users, Zap } from "lucide-react";

const items = [
  ["Permission-aware workspaces", "Every plan receives the tools and limits advertised on the site.", Layers3],
  ["Encrypted credentials", "Marketplace API keys are encrypted on the server—not kept in browser storage.", KeyRound],
  ["Workspace-scoped data", "Inventory, orders, customers, and credentials remain tied to the correct account.", Database],
  ["Preview-first automation", "Potential inventory changes can be reviewed before they affect live records.", ShieldCheck],
  ["Store workflows", "Explore store operations in the plan comparison. Employee accounts are not yet available.", Users],
  ["Fast by design", "Modern Next.js infrastructure keeps the workspace responsive as your operation grows.", Zap],
] as const;

export function TrustSection() {
  return (
    <section data-td-reveal className="relative z-10 bg-[#030b13] px-5 py-24 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1480px]">
        <div className="grid gap-10 lg:grid-cols-[.68fr_1.32fr] lg:items-start">
          <div className="lg:sticky lg:top-32">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Enterprise-grade foundations</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">The details that make software feel trustworthy.</h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-500">Polish is more than animation. Trading Docks is designed around clear access, secure connections, traceable data, and controlled automation.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {items.map(([title, description, Icon]) => (
              <article key={title} className="td-spotlight-card min-h-[240px] rounded-[25px] border border-white/[0.075] bg-[#07131f] p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/[0.14] bg-cyan-300/[0.05] text-cyan-200">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-6 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
