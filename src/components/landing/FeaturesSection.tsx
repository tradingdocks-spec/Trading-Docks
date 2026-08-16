const PRODUCT_AUTHORITIES = [
  {
    name: "Product identity",
    detail: "TCGplayer ID, SKU, set, collector number, language, finish, and image authority.",
    owner: "Scanner + catalog",
  },
  {
    name: "Collection authority",
    detail: "Owned quantity, condition, storage path, deck use, binder status, and wishlist intent.",
    owner: "Inventory records",
  },
  {
    name: "Market intelligence",
    detail: "Movement, demand, spread, source quality, and pricing context without pretending every feed is live.",
    owner: "Market engine",
  },
  {
    name: "Business operations",
    detail: "Purchases, orders, labels, marketplace sync, staff tasks, vendor work, and show prep.",
    owner: "Workspace modules",
  },
];

const DECISION_ROWS = [
  ["What is it?", "Exact product identity", "Prevents wrong-printing inventory"],
  ["What is it worth?", "Market and cost basis", "Supports buying and listing decisions"],
  ["Where is it?", "Storage and location", "Makes physical recovery practical"],
  ["What should happen?", "Workflow state", "Turns records into action"],
];

export function FeaturesSection() {
  return (
    <section
      id="platform"
      data-td-reveal
      className="relative z-10 border-y border-white/[0.06] bg-[#03080d] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-12"
    >
      <div className="mx-auto grid max-w-[1480px] min-w-0 gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="min-w-0">
          <p className="text-sm font-medium text-cyan-200">Platform authority</p>
          <h2 className="mt-4 text-4xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-5xl">
            Trading Docks is built around records that can be trusted later.
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-slate-500">
            The public product is not a bundle of feature cards. It is a chain
            of authorities that answer the operational questions a card creates.
          </p>
        </div>

        <div className="min-w-0">
          <div className="grid border-y border-white/[0.08] md:grid-cols-2">
            {PRODUCT_AUTHORITIES.map((item) => (
              <article
                key={item.name}
                className="border-b border-white/[0.08] py-5 pr-5 odd:md:border-r even:md:pl-5 md:[&:nth-last-child(-n+2)]:border-b-0"
              >
                <p className="text-xs text-slate-700">{item.owner}</p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white">
                  {item.name}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-500">{item.detail}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 min-w-0 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs text-slate-600">
                  <th className="py-3 pr-6 font-medium">Question</th>
                  <th className="px-4 py-3 font-medium">Authority</th>
                  <th className="px-4 py-3 font-medium">Why it matters</th>
                </tr>
              </thead>
              <tbody>
                {DECISION_ROWS.map(([question, authority, reason]) => (
                  <tr key={question} className="border-b border-white/[0.055] last:border-b-0">
                    <td className="py-4 pr-6 text-sm font-medium text-slate-300">{question}</td>
                    <td className="px-4 py-4 text-sm text-slate-500">{authority}</td>
                    <td className="px-4 py-4 text-sm text-slate-500">{reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
