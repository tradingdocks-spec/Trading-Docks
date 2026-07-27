export function MetricGrid() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Inventory Value", "$482,114"],
        ["Monthly Revenue", "$18,421"],
        ["Orders Today", "38"],
        ["Active Listings", "7,284"],
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
