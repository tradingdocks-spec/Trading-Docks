export function MetricGrid() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Inventory Value", "$0"],
        ["Monthly Revenue", "$0"],
        ["Orders Today", "0"],
        ["Active Listings", "0"],
      ].map(([title, value]) => (
        <article
          key={title}
          className="rounded-3xl border border-td-ink/10 bg-td-ink/[0.03] p-6"
        >
          <p className="text-xs uppercase tracking-wider text-td-muted">
            {title}
          </p>

          <p className="mt-3 text-3xl font-semibold text-td-primary">
            {value}
          </p>
        </article>
      ))}
    </section>
  );
}
