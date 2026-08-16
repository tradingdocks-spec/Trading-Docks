const SOURCE_ROWS = [
  ["TCGplayer", "Catalog, SKU, pricing, order import", "Server-side provider"],
  ["Mana Pool", "Seller synchronization and marketplace records", "Workspace credentials"],
  ["Scryfall", "Magic card reference and imagery", "Reference data"],
  ["CSV", "Bulk imports, conversion, marketplace upload prep", "User-controlled files"],
  ["Email", "Order intake and review", "Server-side parser"],
  ["Scanner", "Recognition candidates and intake workflow", "Mobile capture"],
];

const GUARANTEES = [
  "Credentials remain server-side and workspace-scoped.",
  "Catalog identity stays separate from owned inventory.",
  "Imports are previewed before inventory authority changes.",
  "Missing provider data is surfaced honestly instead of faked.",
];

export function EcosystemSection() {
  return (
    <section
      data-td-reveal
      className="relative z-10 border-y border-white/[0.06] bg-[#03080d] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-12"
    >
      <div className="mx-auto grid max-w-[1480px] min-w-0 gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="min-w-0">
          <p className="text-sm font-medium text-cyan-200">Connected sources</p>
          <h2 className="mt-4 text-4xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-5xl">
            Integrations feed the operating system. They do not become the system.
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-slate-500">
            Trading Docks keeps product identity, inventory ownership, market
            data, and workspace operations distinct so one provider failure does
            not corrupt the rest of the product.
          </p>
        </div>

        <div className="min-w-0">
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs text-slate-600">
                  <th className="py-3 pr-6 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Used for</th>
                  <th className="px-4 py-3 font-medium">Authority</th>
                </tr>
              </thead>
              <tbody>
                {SOURCE_ROWS.map(([source, use, authority]) => (
                  <tr key={source} className="border-b border-white/[0.055] last:border-b-0">
                    <td className="py-4 pr-6 text-sm font-semibold text-slate-200">{source}</td>
                    <td className="px-4 py-4 text-sm text-slate-500">{use}</td>
                    <td className="px-4 py-4 text-sm text-slate-500">{authority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {GUARANTEES.map((item) => (
              <p key={item} className="border-l border-cyan-300/30 pl-4 text-sm leading-6 text-slate-500">
                {item}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
