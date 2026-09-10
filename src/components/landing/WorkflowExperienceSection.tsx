const LIFECYCLE_TRACE = [
  ["01", "Acquire", "Evaluate buying opportunities with product identity, condition, and margin context."],
  ["02", "Recognize", "Use scanner and catalog providers to narrow candidates without skipping confirmation."],
  ["03", "Organize", "Assign collection records to inventory, storage, decks, binder, wishlist, or listings."],
  ["04", "Price", "Compare market movement, cost basis, channel fees, and buying rules."],
  ["05", "Move", "Route inventory into orders, labels, fulfillment, show prep, or portfolio review."],
  ["06", "Analyze", "Review capital, aging, sell-through, discrepancies, and operational work left open."],
];

export function WorkflowExperienceSection() {
  return (
    <section
      data-td-reveal
      className="relative z-10 bg-td-canvas px-5 py-16 text-td-primary sm:px-8 sm:py-20 lg:px-12"
    >
      <div className="mx-auto max-w-[1480px]">
        <div className="grid min-w-0 gap-10 lg:grid-cols-[360px_1fr]">
          <div className="min-w-0">
            <p className="text-sm font-medium text-td-accent-text">Workflow trace</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-5xl">
              A card should never become an orphaned row.
            </h2>
            <p className="mt-5 text-sm leading-7 text-td-muted">
              Each step creates context for the next one. That is the Trading
              Docks fingerprint: identity, value, location, movement, and review
              stay connected.
            </p>
          </div>

          <div className="min-w-0 border-y border-td-ink/[0.08]">
            {LIFECYCLE_TRACE.map(([number, label, copy]) => (
              <div
                key={label}
                className="grid gap-4 border-b border-td-ink/[0.06] py-5 last:border-b-0 sm:grid-cols-[70px_170px_1fr]"
              >
                <span className="text-sm text-td-muted">{number}</span>
                <h3 className="text-lg font-semibold text-td-primary">{label}</h3>
                <p className="text-sm leading-6 text-td-muted">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
