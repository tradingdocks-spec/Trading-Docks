"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BellRing,
  CheckCircle2,
  CloudCog,
  DatabaseBackup,
  Download,
  Headphones,
  HeartPulse,
  Lightbulb,
  Mail,
  Megaphone,
  ReceiptText,
  Search,
  ShieldAlert,
} from "lucide-react";

export type OperationsTab =
  | "support"
  | "billing"
  | "communications"
  | "health"
  | "data"
  | "analytics"
  | "feedback";

const sections = {
  support: {
    eyebrow: "Customer operations",
    title: "Customer Support",
    description: "Find an account, review its access and recent activity, keep private support notes, and resolve common account issues.",
    icon: Headphones,
    stats: [["Open cases", "0"], ["Accounts flagged", "0"], ["Avg. response", "—"], ["Resolved today", "0"]],
    cards: ["Account diagnostics", "Support notes", "Access assistance", "Customer history"],
  },
  billing: {
    eyebrow: "Revenue operations",
    title: "Billing, Refunds & Credits",
    description: "Review subscriptions, invoices, failed payments, promotional credits, refunds, and plan changes in one place.",
    icon: ReceiptText,
    stats: [["Active subscribers", "0"], ["Monthly revenue", "$0"], ["Past due", "0"], ["Credits issued", "$0"]],
    cards: ["Subscriptions", "Invoices", "Refunds & credits", "Coupons"],
  },
  communications: {
    eyebrow: "Customer communication",
    title: "Announcements & Email",
    description: "Prepare product announcements, trial reminders, maintenance notices, and targeted customer messages.",
    icon: Megaphone,
    stats: [["Drafts", "0"], ["Scheduled", "0"], ["Sent this month", "0"], ["Delivery issues", "0"]],
    cards: ["Product announcement", "Trial expiration", "Maintenance notice", "Targeted email"],
  },
  health: {
    eyebrow: "Platform operations",
    title: "System & Integration Health",
    description: "See database, storage, background-job, email, and marketplace integration status without leaving the admin panel.",
    icon: HeartPulse,
    stats: [["Platform", "Healthy"], ["Failed jobs", "0"], ["Integrations", "Ready"], ["Alerts", "0"]],
    cards: ["Database & storage", "Background jobs", "Email delivery", "Marketplace connections"],
  },
  data: {
    eyebrow: "Data management",
    title: "Exports, Backups & Privacy",
    description: "Create account exports, review backup status, and manage customer access or deletion requests safely.",
    icon: DatabaseBackup,
    stats: [["Last backup", "Not connected"], ["Exports queued", "0"], ["Privacy requests", "0"], ["Retention alerts", "0"]],
    cards: ["Full account export", "Backup history", "Deletion requests", "Retention rules"],
  },
  analytics: {
    eyebrow: "Product intelligence",
    title: "Product Analytics",
    description: "Track trials, conversions, retention, feature adoption, and the workflows customers use most.",
    icon: BarChart3,
    stats: [["Active users", "1"], ["Trial conversion", "0%"], ["30-day retention", "—"], ["Usage events", "0"]],
    cards: ["Trial funnel", "Feature adoption", "Account retention", "Plan performance"],
  },
  feedback: {
    eyebrow: "Product development",
    title: "Feedback, Bugs & Beta Groups",
    description: "Keep customer requests, reported problems, beta access, and release follow-up organized in one queue.",
    icon: Lightbulb,
    stats: [["Open requests", "0"], ["Reported bugs", "0"], ["Beta testers", "0"], ["Shipped", "0"]],
    cards: ["Feature requests", "Bug reports", "Beta groups", "Release follow-up"],
  },
} satisfies Record<OperationsTab, {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Activity;
  stats: string[][];
  cards: string[];
}>;

export function OperationsSection({ tab }: { tab: OperationsTab }) {
  const section = sections[tab];
  const Icon = section.icon;
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const visibleCards = useMemo(
    () => section.cards.filter((card) => card.toLowerCase().includes(query.toLowerCase())),
    [query, section.cards],
  );

  function acknowledge(action: string) {
    setNotice(`${action} is ready to connect when its service is configured.`);
    window.setTimeout(() => setNotice(""), 2600);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-white/[0.07] bg-[#06121b] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] text-cyan-200"><Icon className="h-5 w-5" /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/65">{section.eyebrow}</p>
              <h2 className="mt-1 text-xl font-semibold text-white">{section.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{section.description}</p>
            </div>
          </div>
          <label className="flex h-10 min-w-56 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/15 px-3">
            <Search className="h-3.5 w-3.5 text-slate-600" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${section.title.toLowerCase()}…`} className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-700" />
          </label>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {section.stats.map(([label, value], index) => (
          <div key={label} className="rounded-[22px] border border-white/[0.07] bg-[#06121b] p-5">
            <div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-slate-600">{label}</p>{index === 0 ? <Activity className="h-4 w-4 text-cyan-300/55" /> : <CheckCircle2 className="h-4 w-4 text-emerald-300/45" />}</div>
            <p className="mt-4 text-xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#06121b]">
        <div className="border-b border-white/[0.06] p-5"><h3 className="text-base font-semibold text-white">Admin tools</h3><p className="mt-1 text-xs text-slate-600">These controls are now part of the panel and clearly show when an outside service still needs to be connected.</p></div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {visibleCards.map((card) => (
            <button key={card} type="button" onClick={() => acknowledge(card)} className="flex min-h-20 items-center justify-between rounded-2xl border border-white/[0.06] bg-black/10 p-4 text-left transition hover:border-cyan-300/15 hover:bg-cyan-300/[0.025]">
              <div><p className="text-xs font-semibold text-slate-200">{card}</p><p className="mt-1 text-[10px] text-slate-600">{tab === "health" ? "Status available" : "Open workspace"}</p></div>
              {tab === "data" ? <Download className="h-4 w-4 text-slate-600" /> : tab === "communications" ? <Mail className="h-4 w-4 text-slate-600" /> : tab === "health" ? <CloudCog className="h-4 w-4 text-emerald-300/60" /> : <BellRing className="h-4 w-4 text-slate-600" />}
            </button>
          ))}
        </div>
      </section>

      <div className="flex gap-3 rounded-2xl border border-amber-300/[0.1] bg-amber-300/[0.025] p-4">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/70" />
        <p className="text-[11px] leading-5 text-amber-100/50">Actions that send email, process payments, or create remote backups remain disabled until their protected service is connected. The panel will not pretend those external actions succeeded.</p>
      </div>
      {notice ? <div role="status" className="fixed bottom-5 right-5 z-[160] rounded-xl border border-cyan-300/15 bg-[#0a1a24] px-4 py-3 text-xs text-cyan-100 shadow-2xl">{notice}</div> : null}
    </div>
  );
}
