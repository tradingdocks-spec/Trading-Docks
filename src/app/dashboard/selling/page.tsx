import Link from "next/link";
import { ArrowUpRight, Boxes, CircleAlert, ClipboardList, DollarSign, Layers3, PackageCheck, Store } from "lucide-react";

const metrics = [
  { label: "Active listings", value: "—", detail: "Connect a marketplace to begin", icon: Store, tone: "text-td-accent-text" },
  { label: "Unlisted value", value: "—", detail: "Based on owned inventory", icon: Boxes, tone: "text-blue-300" },
  { label: "Needs attention", value: "—", detail: "Readiness checks appear here", icon: CircleAlert, tone: "text-amber-300" },
  { label: "Orders to pick", value: "—", detail: "Imported orders stay traceable", icon: PackageCheck, tone: "text-emerald-300" },
];

const routes = [
  { href: "/dashboard/selling/listings", label: "Listing workstation", description: "Prepare inventory candidates with physical provenance intact.", icon: ClipboardList },
  { href: "/dashboard/selling/pricing", label: "Pricing rules", description: "Preview market-based pricing before changing candidates.", icon: DollarSign },
  { href: "/dashboard/selling/connections", label: "Marketplace connections", description: "Review account health and adapter capabilities.", icon: Store },
  { href: "/dashboard/selling/pick-pack", label: "Pick & pack", description: "Fulfill from the exact location and batch that sold.", icon: Layers3 },
];

export default function SellingPage() {
  return (
    <div className="min-h-[calc(100vh-72px)] bg-[radial-gradient(circle_at_top_right,rgb(var(--td-accent-rgb)/.08),transparent_34%),var(--td-background-primary)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-col justify-between gap-5 border-b border-td-ink/[.08] pb-6 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.22em] text-td-accent-text">Selling workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] text-td-primary sm:text-4xl">From owned inventory to realized profit.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-td-secondary">Prepare listings, preserve physical provenance, and coordinate every marketplace from one inventory truth.</p>
          </div>
          <Link href="/dashboard/selling/listings" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--td-action-primary)] px-4 text-sm font-bold text-td-on-accent transition hover:-translate-y-px hover:bg-[var(--td-action-primary-hover)]">
            Open listing workstation <ArrowUpRight className="h-4 w-4" />
          </Link>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Selling summary">
          {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
            <div key={label} className="rounded-2xl border border-td-ink/[.08] bg-td-surface/70 p-5 shadow-[0_18px_50px_rgb(var(--td-shadow-rgb)/.12)]">
              <div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[.16em] text-td-muted">{label}</span><Icon className={`h-4 w-4 ${tone}`} /></div>
              <p className="mt-4 text-3xl font-semibold text-td-primary">{value}</p>
              <p className="mt-1 text-xs text-td-muted">{detail}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
          <div className="rounded-2xl border border-td-ink/[.08] bg-td-surface/70 p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-td-muted">Seller actions</p><h2 className="mt-2 text-xl font-semibold text-td-primary">Build the next listing batch</h2><p className="mt-2 text-sm text-td-secondary">The first release establishes the workflow around your existing inventory, not a duplicate catalog.</p></div><Layers3 className="h-5 w-5 text-td-accent-text" /></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {routes.map(({ href, label, description, icon: Icon }) => <Link key={href} href={href} className="group rounded-xl border border-td-ink/[.08] bg-black/10 p-4 transition hover:border-td-accent/30 hover:bg-td-accent/[.04]"><div className="flex items-center gap-3"><Icon className="h-4 w-4 text-td-accent-text" /><span className="text-sm font-semibold text-td-primary">{label}</span><ArrowUpRight className="ml-auto h-4 w-4 text-td-muted transition group-hover:text-td-accent-text" /></div><p className="mt-2 text-xs leading-5 text-td-muted">{description}</p></Link>)}
            </div>
          </div>
          <div className="rounded-2xl border border-td-accent/20 bg-td-accent/[.04] p-6"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-td-accent-text">System boundary</p><h2 className="mt-2 text-xl font-semibold text-td-primary">Inventory stays authoritative.</h2><p className="mt-3 text-sm leading-6 text-td-secondary">A listing candidate points to an inventory item and, when available, its Chaos Sort position, batch, and location. Publishing never creates physical inventory.</p><div className="mt-5 space-y-3 text-xs text-td-secondary"><div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-emerald-400" />Physical quantity is allocated once</div><div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-emerald-400" />Marketplace visibility is separate</div><div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-emerald-400" />External actions remain deliberate</div></div></div>
        </section>
      </div>
    </div>
  );
}
