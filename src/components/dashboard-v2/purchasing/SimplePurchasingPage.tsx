import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  History,
  Percent,
  Scale,
} from "lucide-react";

const configs = {
  bulk: {
    eyebrow: "Bulk Buying",
    title: "Price bulk inventory consistently.",
    detail:
      "Count or weigh commons, uncommons, rares, mythics, foils, lands, and mixed long boxes using configurable store rates.",
    icon: Scale,
    cards: [
      ["Commons / Uncommons", "$10.00 per 1,000"],
      ["Bulk Rares", "$0.10 each"],
      ["Bulk Mythics", "$0.25 each"],
      ["Basic Lands", "$4.00 per 1,000"],
    ],
  },
  history: {
    eyebrow: "Purchase History",
    title: "Every customer purchase in one place.",
    detail:
      "Search receipts, customers, cash and store-credit payouts, intake status, employee activity, and lifetime purchase totals.",
    icon: History,
    cards: [
      ["Today", "18 purchases - $4,286"],
      ["This Week", "103 purchases - $22,741"],
      ["Pending Intake", "7 purchases"],
      ["Customer Records", "1,284 profiles"],
    ],
  },
  rules: {
    eyebrow: "Buying Rules",
    title: "Control every offer from one rules engine.",
    detail:
      "Configure value tiers, condition adjustments, high-demand bonuses, overstock reductions, sealed risk, and store-credit incentives.",
    icon: Percent,
    cards: [
      ["Singles $0-$5", "55% base offer"],
      ["Singles $100+", "80% base offer"],
      ["Reserved List", "+8% demand bonus"],
      ["Overstock", "Up to -15%"],
    ],
  },
  recommendations: {
    eyebrow: "AI Recommendations",
    title: "Know what to buy, avoid, or reprice.",
    detail:
      "Combine demand, inventory depth, sales velocity, margin, and market movement into clear purchasing recommendations.",
    icon: BrainCircuit,
    cards: [
      ["Buy More", "Commander staples"],
      ["Reduce Offers", "Overstocked sealed"],
      ["Avoid Buying", "Low-velocity reprints"],
      ["Margin Alert", "Premium Pokémon"],
    ],
  },
} as const;

export function SimplePurchasingPage({
  type,
}: {
  type: keyof typeof configs;
}) {
  const config = configs[type];
  const Icon = config.icon;

  return (
    <main className="min-h-screen bg-td-canvas px-5 py-7 text-td-primary sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1450px]">
        <header className="rounded-[28px] border border-td-accent/[0.11] bg-td-surface p-6 sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-td-accent/[0.12] bg-td-accent/[0.04] text-td-accent-text">
            <Icon className="h-5 w-5" />
          </div>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text">
            {config.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em]">
            {config.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-td-muted">
            {config.detail}
          </p>
        </header>

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {config.cards.map(([title, value]) => (
            <div
              key={title}
              className="rounded-[22px] border border-td-ink/[0.07] bg-td-surface p-5"
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-td-muted">
                {title}
              </p>
              <p className="mt-3 text-lg font-semibold text-td-primary">
                {value}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-5 rounded-[24px] border border-dashed border-td-ink/[0.08] bg-td-surface px-6 py-20 text-center">
          <p className="text-sm font-semibold text-td-secondary">
            Purchasing workspace activity
          </p>
          <p className="mx-auto mt-2 max-w-xl text-[11px] leading-5 text-td-muted">
            Purchasing records, rules, recommendations, and history belong in the
            same workspace data model.
          </p>
          <Link
            href="/dashboard/purchasing"
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-td-accent/[0.13] bg-td-accent/[0.04] px-4 text-[11px] font-semibold text-td-accent-text"
          >
            Back to Purchasing
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      </div>
    </main>
  );
}
