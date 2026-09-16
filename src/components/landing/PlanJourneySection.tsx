import { MEMBERSHIP_PLANS, type MembershipTier } from "@/lib/membership-catalog";

const PLAN_STAGES: Array<{
  tier: MembershipTier;
  motion: string;
  operationalQuestion: string;
}> = [
  { tier: "free", motion: "Organize", operationalQuestion: "Can I get my cards into one reliable place?" },
  { tier: "collector", motion: "Understand", operationalQuestion: "What is my collection worth and where is it moving?" },
  { tier: "seller", motion: "Sell", operationalQuestion: "What should I buy, list, reprice, or fulfill today?" },
  { tier: "store", motion: "Operate", operationalQuestion: "How do teams, vendors, shows, customers, and inventory stay aligned?" },
];

function price(tier: MembershipTier) {
  const monthly = MEMBERSHIP_PLANS[tier].monthlyPrice;
  return monthly === 0 ? "$0" : `$${monthly.toFixed(2)}`;
}

export function PlanJourneySection() {
  return (
    <section
      id="plans"
      data-td-reveal
      className="relative z-10 border-y border-td-ink/[0.06] bg-td-canvas px-5 py-16 text-td-primary sm:px-8 sm:py-20 lg:px-12"
    >
      <div className="mx-auto max-w-[1480px]">
        <div className="grid min-w-0 gap-10 lg:grid-cols-[360px_1fr]">
          <div className="min-w-0">
            <p className="text-sm font-medium text-td-accent-text">Plan progression</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-5xl">
              Organize, understand, sell, operate.
            </h2>
            <p className="mt-5 text-sm leading-7 text-td-muted">
              The plan ladder follows the same product story as the homepage.
              Upgrade when the next operational question becomes real.
            </p>
          </div>

          <div className="min-w-0 border-y border-td-ink/[0.08]">
            {PLAN_STAGES.map((stage, index) => {
              const plan = MEMBERSHIP_PLANS[stage.tier];
              return (
                <div
                  key={stage.tier}
                  className="grid gap-4 border-b border-td-ink/[0.06] py-5 last:border-b-0 md:grid-cols-[64px_150px_120px_1fr]"
                >
                  <span className="text-sm text-td-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-td-primary">{plan.name}</p>
                    <p className="mt-1 text-xs text-td-muted">{stage.motion}</p>
                  </div>
                  <p className="text-2xl font-semibold tracking-[-0.04em] text-td-primary">
                    {price(stage.tier)}
                  </p>
                  <p className="text-sm leading-6 text-td-muted">{stage.operationalQuestion}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
