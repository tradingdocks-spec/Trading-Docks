"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Barcode,
  ExternalLink,
  Loader2,
  Minus,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";

type SealedProduct = {
  productId: number;
  categoryId: number;
  categoryName: string;
  groupId: number;
  groupName: string;
  name: string;
  cleanName: string;
  productType: string;
  imageUrl: string;
  productUrl: string;
  marketPrice: number;
  lowPrice: number;
  midPrice: number;
  directLowPrice: number;
  priceSubtype: string;
  isPresale: boolean;
  releasedOn: string | null;
  modifiedOn: string | null;
  dataSource: "TCGCSV";
};

type Line = SealedProduct & {
  quantity: number;
  condition: string;
  inventoryOwned: number;
  shippingCost: number;
  marketplaceFeePercent: number;
};

const GAME_OPTIONS = [
  "All",
  "Magic",
  "Pokemon",
  "Lorcana",
  "One Piece",
];

const CONDITION_MULTIPLIER: Record<string, number> = {
  "Factory Sealed": 1,
  "Minor Wrap Damage": 0.92,
  "Damaged Packaging": 0.8,
  "Distributor Case": 1.02,
};

export function SealedBuyingWorkspace() {
  const [query, setQuery] = useState("");
  const [game, setGame] = useState("Magic");
  const [results, setResults] =
    useState<SealedProduct[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [cashPercent, setCashPercent] =
    useState(70);
  const [creditBonus, setCreditBonus] =
    useState(15);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(
    "Search TCGCSV for live sealed-product pricing.",
  );
  const [lastUpdated, setLastUpdated] =
    useState("");

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      searchProducts();
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [query, game]);

  async function searchProducts() {
    const normalized = query.trim();

    if (normalized.length < 2) return;

    setLoading(true);
    setStatus("Searching TCGCSV products and prices...");

    try {
      const params = new URLSearchParams({
        q: normalized,
        category: game,
        limit: "30",
      });

      const response = await fetch(
        `/api/tcgcsv/sealed/search?${params.toString()}`,
        { cache: "no-store" },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ?? "TCGCSV search failed.",
        );
      }

      setResults(payload.results ?? []);
      setLastUpdated(payload.updatedAt ?? "");
      setStatus(
        `${payload.results?.length ?? 0} sealed products found across ${payload.scannedGroups ?? 0} product groups.`,
      );
    } catch (error) {
      setResults([]);
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to search TCGCSV.",
      );
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    return lines.reduce(
      (totals, line) => {
        const conditionValue =
          CONDITION_MULTIPLIER[line.condition] ?? 1;
        const adjustedMarket =
          line.marketPrice *
          line.quantity *
          conditionValue;
        const cashOffer =
          adjustedMarket * (cashPercent / 100);
        const storeCredit =
          cashOffer * (1 + creditBonus / 100);
        const sellingFees =
          adjustedMarket *
          (line.marketplaceFeePercent / 100);
        const shipping =
          line.shippingCost * line.quantity;
        const netSale =
          adjustedMarket - sellingFees - shipping;
        const expectedProfit = netSale - cashOffer;

        return {
          market: totals.market + adjustedMarket,
          cash: totals.cash + cashOffer,
          credit: totals.credit + storeCredit,
          fees: totals.fees + sellingFees,
          shipping: totals.shipping + shipping,
          netSale: totals.netSale + netSale,
          profit: totals.profit + expectedProfit,
        };
      },
      {
        market: 0,
        cash: 0,
        credit: 0,
        fees: 0,
        shipping: 0,
        netSale: 0,
        profit: 0,
      },
    );
  }, [lines, cashPercent, creditBonus]);

  function addProduct(product: SealedProduct) {
    setLines((current) => {
      const existing = current.find(
        (line) => line.productId === product.productId,
      );

      if (existing) {
        return current.map((line) =>
          line.productId === product.productId
            ? {
                ...line,
                quantity: line.quantity + 1,
              }
            : line,
        );
      }

      return [
        ...current,
        {
          ...product,
          quantity: 1,
          condition: "Factory Sealed",
          inventoryOwned: 0,
          shippingCost: 12,
          marketplaceFeePercent: 13.25,
        },
      ];
    });
  }

  return (
    <main className="min-h-screen bg-[#020b12] px-5 py-7 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="rounded-[28px] border border-emerald-300/[0.12] bg-[#06141f] p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Sealed Product Buying
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em]">
                Appraise sealed inventory with TCGCSV market data.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                Search TCGplayer products, compare Market, Low, Mid, and Direct
                Low prices, calculate fees and shipping, and protect the store’s
                target margin before making an offer.
              </p>
            </div>

            <div className="rounded-xl border border-cyan-300/[0.11] bg-cyan-400/[0.03] px-4 py-3">
              <p className="text-[7px] uppercase tracking-[0.12em] text-slate-700">
                Pricing Source
              </p>
              <p className="mt-1 text-[10px] font-semibold text-cyan-200">
                TCGCSV · Daily TCGplayer cache
              </p>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_1.45fr_0.74fr]">
          <section className="rounded-[24px] border border-white/[0.07] bg-[#06141f] p-5">
            <div className="flex items-center justify-between">
              <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-cyan-300">
                Live Product Search
              </p>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-[0.38fr_1fr] gap-2">
              <select
                value={game}
                onChange={(event) =>
                  setGame(event.target.value)
                }
                className="h-11 rounded-xl border border-white/[0.07] bg-[#07141e] px-3 text-[9px] text-slate-400 outline-none"
              >
                {GAME_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>

              <label className="flex h-11 items-center gap-2 rounded-xl border border-white/[0.07] bg-black/[0.1] px-3">
                <Search className="h-4 w-4 text-slate-700" />
                <input
                  value={query}
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      searchProducts();
                    }
                  }}
                  placeholder="Booster box, bundle, UPC..."
                  className="min-w-0 flex-1 bg-transparent text-[10px] text-slate-300 outline-none placeholder:text-slate-700"
                />
              </label>
            </div>

            <button
              type="button"
              className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/[0.12] bg-cyan-400/[0.035] text-[9px] font-semibold text-cyan-200"
            >
              <Barcode className="h-4 w-4" />
              Scan UPC barcode
            </button>

            <p className="mt-3 text-[7px] leading-4 text-slate-700">
              {status}
              {lastUpdated
                ? ` Updated ${new Date(
                    lastUpdated,
                  ).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}.`
                : ""}
            </p>

            <div className="mt-4 max-h-[760px] space-y-2 overflow-y-auto pr-1">
              {results.map((product) => {
                const suggestedCash =
                  product.marketPrice * (cashPercent / 100);

                return (
                  <article
                    key={product.productId}
                    className="group rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-300/[0.2] hover:bg-white/[0.025]"
                  >
                    <div className="flex gap-3">
                      <ProductImage product={product} searchLarge />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold leading-5 text-white">
                              {product.name}
                            </p>
                            <p className="mt-1 text-[9px] leading-4 text-slate-500">
                              {product.groupName}
                            </p>
                          </div>
                        </div>

                        <span className="mt-2 inline-flex rounded-lg border border-cyan-300/[0.12] bg-cyan-400/[0.04] px-2 py-1 text-[7px] font-semibold uppercase tracking-[0.1em] text-cyan-200">
                          {product.dataSource}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <SearchPriceTile
                        label="Market"
                        value={currency(product.marketPrice)}
                        tone="market"
                      />
                      <SearchPriceTile
                        label="Suggested Cash"
                        value={currency(suggestedCash)}
                        tone="cash"
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <SearchInfoTile
                        label="Expected Profit"
                        value={currency(
                          Math.max(
                            0,
                            product.marketPrice -
                              product.marketPrice * 0.1325 -
                              12 -
                              suggestedCash,
                          ),
                        )}
                        tone="profit"
                      />
                      <SearchInfoTile
                        label="Margin"
                        value={`${Math.max(
                          0,
                          ((product.marketPrice -
                            product.marketPrice * 0.1325 -
                            12 -
                            suggestedCash) /
                            Math.max(
                              1,
                              product.marketPrice -
                                product.marketPrice * 0.1325 -
                                12,
                            )) *
                            100,
                        ).toFixed(1)}%`}
                        tone="margin"
                      />
                      <SearchInfoTile
                        label="Inventory"
                        value="0 Owned"
                        tone="inventory"
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.055] pt-3">
                      <div className="flex min-w-0 flex-wrap gap-1.5">
                        <Badge>{product.productType}</Badge>
                        <Badge>{product.categoryName}</Badge>
                        {product.isPresale ? <Badge>Presale</Badge> : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => addProduct(product)}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-300 px-5 text-[10px] font-semibold text-[#00140d] transition hover:bg-emerald-200"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </button>
                    </div>
                  </article>
                );
              })}

              {!loading &&
              query.trim().length >= 2 &&
              !results.length ? (
                <div className="rounded-2xl border border-dashed border-white/[0.07] py-12 text-center text-[8px] text-slate-700">
                  No matching sealed products were found.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-[24px] border border-white/[0.07] bg-[#06141f] p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-cyan-300">
                  Sealed Appraisal
                </p>
                <h2 className="mt-2 text-lg font-semibold">
                  Products in offer
                </h2>
              </div>
              <span className="text-[8px] text-slate-700">
                {lines.length} lines
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {lines.map((line) => {
                const adjustedMarket =
                  line.marketPrice *
                  line.quantity *
                  CONDITION_MULTIPLIER[line.condition];
                const cashOffer =
                  adjustedMarket *
                  (cashPercent / 100);
                const fees =
                  adjustedMarket *
                  (line.marketplaceFeePercent / 100);
                const shipping =
                  line.shippingCost * line.quantity;
                const netSale =
                  adjustedMarket - fees - shipping;
                const profit =
                  netSale - cashOffer;
                const margin =
                  netSale > 0
                    ? (profit / netSale) * 100
                    : 0;

                return (
                  <article
                    key={line.productId}
                    className="rounded-2xl border border-white/[0.06] bg-black/[0.09] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <ProductImage product={line} large />

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white">
                          {line.name}
                        </p>
                        <p className="mt-1 text-[8px] text-slate-700">
                          {line.categoryName} · {line.groupName}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge>{line.productType}</Badge>
                          <Badge>{line.priceSubtype}</Badge>
                          {line.isPresale ? (
                            <Badge>Presale</Badge>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setLines((current) =>
                            current.filter(
                              (item) =>
                                item.productId !==
                                line.productId,
                            ),
                          )
                        }
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-300/[0.1] text-red-300/60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label="Quantity">
                        <Quantity
                          value={line.quantity}
                          onChange={(quantity) =>
                            patchLine(
                              line.productId,
                              { quantity },
                              setLines,
                            )
                          }
                        />
                      </Field>

                      <Field label="Condition">
                        <select
                          value={line.condition}
                          onChange={(event) =>
                            patchLine(
                              line.productId,
                              {
                                condition:
                                  event.target.value,
                              },
                              setLines,
                            )
                          }
                          className="h-10 w-full rounded-xl border border-white/[0.06] bg-[#07141e] px-3 text-[8px] text-slate-400 outline-none"
                        >
                          {Object.keys(
                            CONDITION_MULTIPLIER,
                          ).map((condition) => (
                            <option key={condition}>
                              {condition}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Inventory Owned">
                        <NumberInput
                          value={line.inventoryOwned}
                          onChange={(inventoryOwned) =>
                            patchLine(
                              line.productId,
                              { inventoryOwned },
                              setLines,
                            )
                          }
                        />
                      </Field>

                      <Field label="Shipping / Unit">
                        <MoneyInput
                          value={line.shippingCost}
                          onChange={(shippingCost) =>
                            patchLine(
                              line.productId,
                              { shippingCost },
                              setLines,
                            )
                          }
                        />
                      </Field>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
                      <ValueBox
                        label="TCG Market"
                        value={adjustedMarket}
                        tone="market"
                      />
                      <ValueBox
                        label="TCG Low"
                        value={
                          line.lowPrice * line.quantity
                        }
                        tone="neutral"
                      />
                      <ValueBox
                        label="Direct Low"
                        value={
                          line.directLowPrice *
                          line.quantity
                        }
                        tone="neutral"
                      />
                      <ValueBox
                        label="Cash Offer"
                        value={cashOffer}
                        tone="cash"
                      />
                      <ValueBox
                        label="Expected Profit"
                        value={profit}
                        tone={
                          profit >= 0 ? "profit" : "risk"
                        }
                      />
                      <ValueBox
                        label="Margin"
                        value={margin}
                        tone={
                          margin >= 15 ? "profit" : "risk"
                        }
                        percent
                      />
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <InfoBox
                        label="Marketplace Fees"
                        value={currency(fees)}
                      />
                      <InfoBox
                        label="Shipping"
                        value={currency(shipping)}
                      />
                      <InfoBox
                        label="Net Sale Proceeds"
                        value={currency(netSale)}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-[7px] text-slate-700">
                        TCGCSV product #{line.productId}
                      </p>

                      {line.productUrl ? (
                        <a
                          href={line.productUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[7px] font-semibold text-cyan-300"
                        >
                          View TCGplayer product
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}

              {!lines.length ? (
                <div className="rounded-2xl border border-dashed border-white/[0.07] py-20 text-center">
                  <PackageCheck className="mx-auto h-6 w-6 text-slate-800" />
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    No sealed products added
                  </p>
                  <p className="mt-1 text-[8px] text-slate-700">
                    Search TCGCSV or scan a UPC to begin.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[24px] border border-emerald-300/[0.12] bg-[#06141f] p-5">
              <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-emerald-300">
                Customer Offer
              </p>

              <Summary
                label="Market Value"
                value={totals.market}
                tone="market"
              />
              <Summary
                label="Cash Offer"
                value={totals.cash}
                tone="cash"
              />
              <Summary
                label="Store Credit"
                value={totals.credit}
                tone="credit"
              />

              <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/[0.1] p-3">
                <SummaryRow
                  label="Expected Fees"
                  value={totals.fees}
                />
                <SummaryRow
                  label="Expected Shipping"
                  value={totals.shipping}
                />
                <SummaryRow
                  label="Net Sale"
                  value={totals.netSale}
                />
                <SummaryRow
                  label="Expected Profit"
                  value={totals.profit}
                  strong
                />
              </div>

              <button
                type="button"
                disabled={!lines.length}
                className="mt-4 h-11 w-full rounded-xl bg-emerald-300 text-[9px] font-semibold text-[#00140d] disabled:opacity-40"
              >
                Purchase and send to intake
              </button>
            </section>

            <section className="rounded-[24px] border border-white/[0.07] bg-[#06141f] p-5">
              <p className="text-sm font-semibold">
                Buying controls
              </p>

              <Range
                label="Cash offer"
                value={cashPercent}
                setValue={setCashPercent}
                suffix="%"
                min={40}
                max={90}
              />
              <Range
                label="Store credit bonus"
                value={creditBonus}
                setValue={setCreditBonus}
                suffix="%"
                min={0}
                max={30}
              />
            </section>

            <section className="rounded-[24px] border border-amber-300/[0.11] bg-[#06141f] p-5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-300" />
                <p className="text-sm font-semibold">
                  Purchase intelligence
                </p>
              </div>
              <p className="mt-3 text-[8px] leading-5 text-slate-600">
                The offer combines TCGCSV Market Price with packaging
                condition, store offer percentage, marketplace fees, shipping,
                and current inventory. Daily syncs can save price history in
                Supabase for future 7-day, 30-day, and one-year charts.
              </p>
            </section>

            <button
              type="button"
              onClick={searchProducts}
              disabled={loading || query.trim().length < 2}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/[0.12] bg-cyan-400/[0.035] text-[8px] font-semibold text-cyan-200 disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh TCGCSV results
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ProductImage({
  product,
  large = false,
  searchLarge = false,
}: {
  product: SealedProduct;
  large?: boolean;
  searchLarge?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const image = product.imageUrl
    ? `/api/tcgcsv/image?url=${encodeURIComponent(
        product.imageUrl,
      )}`
    : "";

  useEffect(() => {
    setFailed(false);
  }, [image]);

  return (
    <div
      className={[
        "shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-cyan-950 to-slate-950",
        large
          ? "h-[88px] w-[88px]"
          : searchLarge
            ? "h-[118px] w-[88px]"
            : "h-[72px] w-[58px]",
      ].join(" ")}
    >
      {image && !failed ? (
        <img
          src={image}
          alt={product.name}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-2 text-center text-[7px] font-semibold text-cyan-200">
          {product.categoryName}
        </div>
      )}
    </div>
  );
}

function SearchPriceTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "market" | "cash";
}) {
  const classes = {
    market:
      "border-emerald-300/[0.18] bg-emerald-400/[0.05] text-emerald-300",
    cash:
      "border-cyan-300/[0.18] bg-cyan-400/[0.05] text-cyan-200",
  }[tone];

  const compact = value.length >= 10;

  return (
    <div className={`min-w-0 overflow-hidden rounded-xl border px-4 py-3.5 ${classes}`}>
      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-600">
        {label}
      </p>
      <p
        className={[
          "mt-2 whitespace-nowrap font-bold leading-none tracking-[-0.035em] tabular-nums",
          compact ? "text-[22px]" : "text-[26px]",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function SearchInfoTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "profit" | "margin" | "inventory";
}) {
  const valueClass = {
    profit: "text-violet-200",
    margin: "text-amber-200",
    inventory: "text-slate-300",
  }[tone];

  return (
    <div className="min-w-0 rounded-xl border border-white/[0.055] bg-black/[0.08] px-3 py-2.5">
      <p className="text-[7px] font-semibold uppercase leading-3 tracking-[0.08em] text-slate-600">
        {label}
      </p>
      <p className={`mt-1.5 whitespace-nowrap text-sm font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function Quantity({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex h-10 items-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <button
        type="button"
        onClick={() =>
          onChange(Math.max(1, value - 1))
        }
        className="flex h-full w-9 items-center justify-center text-slate-600"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="flex-1 text-center text-[10px]">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-full w-9 items-center justify-center text-cyan-300"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(event) =>
        onChange(
          Math.max(0, Number(event.target.value) || 0),
        )
      }
      className="h-10 w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 text-[9px] text-slate-300 outline-none"
    />
  );
}

function MoneyInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex h-10 items-center rounded-xl border border-white/[0.06] bg-white/[0.02] px-3">
      <span className="text-[9px] text-slate-700">$</span>
      <input
        type="number"
        min={0}
        step="0.25"
        value={value}
        onChange={(event) =>
          onChange(
            Math.max(
              0,
              Number(event.target.value) || 0,
            ),
          )
        }
        className="min-w-0 flex-1 bg-transparent pl-1 text-[9px] text-slate-300 outline-none"
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[7px] uppercase tracking-[0.11em] text-slate-700">
        {label}
      </p>
      {children}
    </div>
  );
}

function ValueBox({
  label,
  value,
  tone,
  percent = false,
}: {
  label: string;
  value: number;
  tone:
    | "market"
    | "cash"
    | "neutral"
    | "profit"
    | "risk";
  percent?: boolean;
}) {
  const toneClasses = {
    market:
      "border-sky-300/[0.13] bg-sky-400/[0.035] text-sky-200",
    cash:
      "border-emerald-300/[0.13] bg-emerald-400/[0.035] text-emerald-300",
    neutral:
      "border-white/[0.06] bg-white/[0.018] text-slate-300",
    profit:
      "border-violet-300/[0.13] bg-violet-400/[0.035] text-violet-200",
    risk:
      "border-rose-300/[0.13] bg-rose-400/[0.035] text-rose-300",
  }[tone];

  return (
    <div
      className={`min-w-0 rounded-xl border p-3 ${toneClasses}`}
    >
      <p className="truncate text-[6px] uppercase tracking-[0.1em] text-slate-700">
        {label}
      </p>
      <p className="mt-2 truncate text-[10px] font-semibold">
        {percent
          ? `${value.toFixed(1)}%`
          : currency(value)}
      </p>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2">
      <p className="text-[6px] uppercase tracking-[0.1em] text-slate-800">
        {label}
      </p>
      <p className="mt-1 text-[8px] font-semibold text-slate-500">
        {value}
      </p>
    </div>
  );
}

function Badge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[7px] text-slate-600">
      {children}
    </span>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "market" | "cash" | "credit";
}) {
  return (
    <div
      className={[
        "mt-3 rounded-xl border p-4",
        tone === "market"
          ? "border-sky-300/[0.16] bg-sky-400/[0.04]"
          : tone === "cash"
            ? "border-emerald-300/[0.16] bg-emerald-400/[0.04]"
            : "border-fuchsia-300/[0.16] bg-fuchsia-400/[0.04]",
      ].join(" ")}
    >
      <p className="text-[7px] uppercase tracking-[0.11em] text-slate-700">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold">
        {currency(value)}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[8px] text-slate-600">
        {label}
      </span>
      <span
        className={[
          "text-[9px] font-semibold",
          strong
            ? value >= 0
              ? "text-emerald-300"
              : "text-rose-300"
            : "text-slate-300",
        ].join(" ")}
      >
        {currency(value)}
      </span>
    </div>
  );
}

function Range({
  label,
  value,
  setValue,
  suffix,
  min,
  max,
}: {
  label: string;
  value: number;
  setValue: (value: number) => void;
  suffix: string;
  min: number;
  max: number;
}) {
  return (
    <label className="mt-4 block">
      <div className="flex items-center justify-between text-[8px]">
        <span className="text-slate-600">
          {label}
        </span>
        <span className="font-semibold text-cyan-200">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) =>
          setValue(Number(event.target.value))
        }
        className="mt-3 w-full accent-cyan-300"
      />
    </label>
  );
}

function patchLine(
  productId: number,
  patch: Partial<Line>,
  setLines: React.Dispatch<
    React.SetStateAction<Line[]>
  >,
) {
  setLines((current) =>
    current.map((line) =>
      line.productId === productId
        ? { ...line, ...patch }
        : line,
    ),
  );
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}
