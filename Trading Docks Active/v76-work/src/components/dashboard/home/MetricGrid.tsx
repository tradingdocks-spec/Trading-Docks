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
          className="rounded-3xl border border-white/10 bg-white/[0.03] p-6"
        >
          <p className="text-xs uppercase tracking-wider text-slate-500">
            {title}
          </p>

          <p className="mt-3 text-3xl font-semibold text-white">
            {value}
          </p>
        </article>
      ))}
    </section>
  );
}
