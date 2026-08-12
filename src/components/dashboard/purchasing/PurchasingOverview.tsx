"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Layers3,
  Loader2,
  PackagePlus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  Upload,
  WalletCards,
} from "lucide-react";

import { GameContextControl } from "@/components/dashboard/multi-tcg/GameContextControl";
import { loadAccountDocument } from "@/lib/account-documents";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_PURCHASING_BUYING_RULES,
  PURCHASING_BUYING_RULES_DOCUMENT,
  resolveEffectiveBuyingRule,
  resolvePurchasingBuyingRules,
  type EffectiveBuyingRule,
  type PurchasingBuyingRules,
} from "@/lib/purchasing/buying-rules";
import {
  buildPurchaseWorkspaceLine,
  calculateBuyingOffer,
  toPurchaseHistoryPayload,
  type PurchaseWorkspaceLine,
  type PurchasingLookupResult,
  type PurchasingProductType,
  type PurchasingSkuOption,
} from "@/lib/purchasing/product-lookup";
import type { GameContextId } from "@/lib/multi-tcg";

type StorageOption = {
  id: string;
  name: string;
};
type ProductAction = "add-inventory" | "add-collection" | "add-binder" | "add-trade-binder" | "add-wishlist";

const CART_STORAGE_KEY = "trading-docks:purchasing-intelligence-cart:v1";
const DEFAULT_CONDITIONS = ["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"];
const FIELD_CLASS = "h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 text-xs font-semibold text-white outline-none transition focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/15";

export function PurchasingOverview() {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchRequestRef = useRef(0);
  const [gameContext, setGameContext] = useState<GameContextId>("magic");
  const [productType, setProductType] = useState<"all" | PurchasingProductType>("all");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PurchasingLookupResult[]>([]);
  const [selected, setSelected] = useState<PurchasingLookupResult | null>(null);
  const [selectedSkuId, setSelectedSkuId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [buyingRules, setBuyingRules] = useState<PurchasingBuyingRules>(DEFAULT_PURCHASING_BUYING_RULES);
  const [buyingRulesConfigured, setBuyingRulesConfigured] = useState(false);
  const [buyingRulesLoading, setBuyingRulesLoading] = useState(true);
  const [storageLocationId, setStorageLocationId] = useState("");
  const [locations, setLocations] = useState<StorageOption[]>([]);
  const [cart, setCart] = useState<PurchaseWorkspaceLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [productActionSaving, setProductActionSaving] = useState<ProductAction | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(CART_STORAGE_KEY) ?? "[]");
      if (Array.isArray(parsed)) setCart(parsed as PurchaseWorkspaceLine[]);
    } catch {
      setCart([]);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(async (result: { data: { user: { id: string } | null } }) => {
      if (!result.data.user) return;
      const { data: rows } = await supabase
        .from("inventory_locations")
        .select("id, name")
        .eq("user_id", result.data.user.id)
        .order("name", { ascending: true })
        .limit(200);
      setLocations((rows ?? []).map((row: { id: unknown; name: unknown }) => ({ id: String(row.id), name: String(row.name ?? "Storage location") })));
    });
  }, []);

  useEffect(() => {
    let active = true;
    setBuyingRulesLoading(true);
    void loadAccountDocument(PURCHASING_BUYING_RULES_DOCUMENT)
      .then((document) => {
        if (!active) return;
        const resolved = resolvePurchasingBuyingRules(document);
        setBuyingRules(resolved.rules);
        setBuyingRulesConfigured(resolved.configured);
      })
      .catch(() => {
        if (!active) return;
        setBuyingRules(DEFAULT_PURCHASING_BUYING_RULES);
        setBuyingRulesConfigured(false);
      })
      .finally(() => {
        if (active) setBuyingRulesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSelected(null);
    setSelectedSkuId("");
    setResults([]);
    setError("");
    setNotice("");
  }, [gameContext, productType]);

  const runSearch = useCallback(async (rawQuery = query) => {
    const trimmed = rawQuery.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setSelected(null);
      return;
    }
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        q: trimmed,
        gameId: gameContext,
        productType,
        limit: "12",
      });
      const response = await fetch(`/api/purchasing/product-lookup?${params.toString()}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Product lookup failed.");
      if (searchRequestRef.current !== requestId) return;
      const nextResults = Array.isArray(payload.results) ? payload.results as PurchasingLookupResult[] : [];
      setResults(nextResults);
      setSelected((current) => current && nextResults.some((item) => item.id === current.id) ? current : nextResults[0] ?? null);
    } catch (lookupError) {
      if (searchRequestRef.current === requestId) {
        setError(lookupError instanceof Error ? lookupError.message : "Product lookup failed.");
      }
    } finally {
      if (searchRequestRef.current === requestId) setLoading(false);
    }
  }, [gameContext, productType, query]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void runSearch(trimmed);
    }, 320);
    return () => {
      window.clearTimeout(timer);
    };
  }, [query, runSearch]);

  useEffect(() => {
    setSelectedSkuId(selected?.skus[0]?.id ?? "");
    setQuantity(1);
    setStorageLocationId("");
  }, [selected]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") !== "add-inventory") return;
    searchInputRef.current?.focus();
    setNotice("Search for a product, confirm the exact SKU, then add it to inventory or collection.");
  }, []);

  const selectedSku = useMemo(() => {
    if (!selected) return null;
    return selected.skus.find((sku) => sku.id === selectedSkuId) ?? selected.skus[0] ?? null;
  }, [selected, selectedSkuId]);
  const condition = selectedSku?.condition ?? (selected?.productType === "sealed" ? "Sealed" : DEFAULT_CONDITIONS[0]);
  const variant = selectedSku?.variant ?? selected?.variants[0] ?? "Normal";
  const language = selectedSku?.language ?? "English";
  const effectiveRule = useMemo(() => selected
    ? resolveEffectiveBuyingRule({
      productType: selected.productType,
      rules: buyingRules,
      configured: buyingRulesConfigured,
    })
    : null, [buyingRules, buyingRulesConfigured, selected]);
  const offer = calculateBuyingOffer(
    selectedSku?.marketPrice ?? selected?.marketPrice ?? null,
    effectiveRule?.percent ?? 0,
    effectiveRule?.storeCreditBonusPercent ?? DEFAULT_PURCHASING_BUYING_RULES.storeCreditBonusPercent,
  );
  const cartTotal = cart.reduce((sum, line) => sum + line.unitOffer * line.quantity, 0);
  const cartUnits = cart.reduce((sum, line) => sum + line.quantity, 0);
  const addToPurchaseReason = selected
    ? addToPurchaseDisabledReason({
      product: selected,
      sku: selectedSku,
      quantity,
      offer,
      rule: effectiveRule,
    })
    : "Choose a product before adding it to a purchase.";

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query);
  }

  function addSelectedToCart() {
    if (!selected || addToPurchaseReason || !effectiveRule) return;
    const line = buildPurchaseWorkspaceLine({
      product: selected,
      sku: selectedSku,
      quantity,
      offerPercent: effectiveRule.percent ?? 0,
      storeCreditBonusPercent: effectiveRule.storeCreditBonusPercent,
    });
    setCart((current) => {
      const existing = current.find((item) => item.id === line.id);
      if (!existing) return [...current, line];
      return current.map((item) => item.id === line.id ? { ...item, quantity: item.quantity + line.quantity } : item);
    });
    setNotice(`${selected.name} added to the current purchase.`);
  }

  async function savePurchaseDraft() {
    if (!cart.length) return;
    setSavingPurchase(true);
    setError("");
    try {
      const response = await fetch("/api/purchase-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPurchaseHistoryPayload(cart)),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? payload.message ?? "Purchase draft could not be saved.");
      setCart([]);
      setNotice("Draft purchase saved to Purchase History.");
    } catch (purchaseError) {
      setError(purchaseError instanceof Error ? purchaseError.message : "Purchase draft could not be saved.");
    } finally {
      setSavingPurchase(false);
    }
  }

  async function runProductAction(action: ProductAction) {
    if (!selected) return;
    setProductActionSaving(action);
    setError("");
    try {
      const response = await fetch("/api/purchasing/product-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          product: selected,
          quantity,
          condition,
          variant,
          language,
          storageLocationId: storageLocationId || null,
          costBasis: offer.cashOffer,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Product action could not be completed.");
      setNotice(productActionNotice(action, Boolean(payload.merged)));
    } catch (inventoryError) {
      setError(inventoryError instanceof Error ? inventoryError.message : "Product action could not be completed.");
    } finally {
      setProductActionSaving(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#020b12] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1540px]">
        <header className="rounded-[28px] border border-cyan-300/[0.12] bg-[#06141f] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.28)] sm:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.19em] text-cyan-300">
                Purchasing Intelligence
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
                Search, price, and buy exact products.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                Search any supported product, confirm the exact version, compare the market, and build a purchase with confidence.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
              <Badge label="Exact product matching" />
              <Badge label="Multi-market pricing" />
              <Badge label="Offer intelligence" />
            </div>
          </div>

          <form onSubmit={submitSearch} className="mt-6 grid gap-3 xl:grid-cols-[minmax(280px,1fr)_auto_auto_auto] xl:items-center">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search cards, sealed products, sets, or product IDs..."
                  className="h-12 w-full rounded-2xl border border-white/[0.08] bg-black/25 pl-11 pr-4 text-sm font-medium text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/15"
                />
              </label>
              <button
                type="submit"
                disabled={query.trim().length < 2 || loading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 text-[10px] font-black uppercase tracking-[0.12em] text-[#021018] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </button>
            </div>
            <GameContextControl value={gameContext} onChange={setGameContext} includeAll={false} ariaLabel="Purchasing game context" />
            <SegmentedProductType value={productType} onChange={setProductType} />
            <Link href="/dashboard/card-photo-scanner" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/[0.08] px-4 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 transition hover:border-cyan-300/20 hover:text-cyan-200">
              <Upload className="h-3.5 w-3.5" />
              Upload image
            </Link>
          </form>
        </header>

        {error ? <Status tone="error" message={error} /> : null}
        {notice ? <Status tone="success" message={notice} /> : null}

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.45fr_0.75fr]">
          <ResultsPanel
            query={query}
            loading={loading}
            results={results}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
          <DetailPanel
            product={selected}
            sku={selectedSku}
            selectedSkuId={selectedSkuId}
            onSkuChange={setSelectedSkuId}
            quantity={quantity}
            onQuantityChange={setQuantity}
            buyingRule={effectiveRule}
            buyingRulesLoading={buyingRulesLoading}
            storageLocationId={storageLocationId}
            onStorageLocationChange={setStorageLocationId}
            locations={locations}
            offer={offer}
            addToPurchaseDisabledReason={addToPurchaseReason}
            onAddPurchase={addSelectedToCart}
            onProductAction={runProductAction}
            productActionSaving={productActionSaving}
          />
          <PurchaseCartPanel
            lines={cart}
            units={cartUnits}
            total={cartTotal}
            saving={savingPurchase}
            onSave={savePurchaseDraft}
            onClear={() => setCart([])}
            onRemove={(id) => setCart((current) => current.filter((line) => line.id !== id))}
            onQuantity={(id, nextQuantity) => setCart((current) => current.map((line) => line.id === id ? { ...line, quantity: Math.max(1, nextQuantity) } : line))}
          />
        </section>
      </div>
    </main>
  );
}

function ResultsPanel({ query, loading, results, selectedId, onSelect }: {
  query: string;
  loading: boolean;
  results: PurchasingLookupResult[];
  selectedId: string | null;
  onSelect: (result: PurchasingLookupResult) => void;
}) {
  return (
    <section className="rounded-[26px] border border-white/[0.07] bg-[#06141f] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Search results</p>
          <p className="mt-1 text-xs text-slate-600">{results.length ? `${results.length} products` : "Exact product lookup"}</p>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> : null}
      </div>

      <div className="mt-4 space-y-2">
        {!query.trim() ? (
          <EmptyState title="Search the catalog" detail="Find singles or sealed products to price, purchase, or add to inventory." />
        ) : !loading && !results.length ? (
          <EmptyState title={`No products found for "${query.trim()}"`} detail="Try another spelling, selecting a set, or using a product number." />
        ) : null}
        {results.map((result) => (
          <button
            key={result.id}
            type="button"
            onClick={() => onSelect(result)}
            className={[
              "group flex w-full gap-3 rounded-2xl border p-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-300/70",
              selectedId === result.id
                ? "border-cyan-300/25 bg-cyan-300/[0.06]"
                : "border-white/[0.055] bg-white/[0.018] hover:border-cyan-300/15 hover:bg-white/[0.035]",
            ].join(" ")}
          >
            <ProductImage product={result} size="small" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-cyan-300/[0.1] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-cyan-200">{result.gameLabel}</span>
                <span className="rounded-full bg-white/[0.055] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500">{result.productType === "sealed" ? "Sealed" : "Single"}</span>
              </div>
              <h2 className="mt-2 truncate text-sm font-semibold text-white">{result.name}</h2>
              <p className="mt-1 truncate text-[10px] text-slate-500">{[result.setName, result.collectorNumber ? `#${result.collectorNumber}` : null, result.rarity].filter(Boolean).join(" · ")}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold text-slate-300">{money(result.marketPrice) ?? "Market unavailable"}</p>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-cyan-300">Select <ArrowRight className="h-3 w-3" /></span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function DetailPanel(props: {
  product: PurchasingLookupResult | null;
  sku: PurchasingSkuOption | null;
  selectedSkuId: string;
  onSkuChange: (id: string) => void;
  quantity: number;
  onQuantityChange: (value: number) => void;
  buyingRule: EffectiveBuyingRule | null;
  buyingRulesLoading: boolean;
  storageLocationId: string;
  onStorageLocationChange: (id: string) => void;
  locations: StorageOption[];
  offer: ReturnType<typeof calculateBuyingOffer>;
  addToPurchaseDisabledReason: string | null;
  onAddPurchase: () => void;
  onProductAction: (action: ProductAction) => void;
  productActionSaving: ProductAction | null;
}) {
  const product = props.product;
  if (!product) {
    return (
      <section className="rounded-[28px] border border-white/[0.07] bg-[#06141f] p-8">
        <EmptyState title="Choose a product" detail="Select a result to inspect exact identity, variants, market pricing, and buying math." />
      </section>
    );
  }
  const hasExactSku = product.productType === "sealed" || (props.sku?.marketPrice ?? product.marketPrice) != null;
  const conditionOptions = uniqueSkuValues(product.skus.map((sku) => sku.condition));
  const variantOptions = uniqueSkuValues(product.skus.map((sku) => sku.variant));
  const languageOptions = uniqueSkuValues(product.skus.map((sku) => sku.language));
  const conditionValue = props.sku?.condition ?? conditionOptions[0] ?? "Near Mint";
  const variantValue = props.sku?.variant ?? product.variants[0] ?? "Normal";
  const languageValue = props.sku?.language ?? languageOptions[0] ?? "English";
  const chooseSku = (next: { condition?: string; variant?: string; language?: string }) => {
    const target = {
      condition: next.condition ?? conditionValue,
      variant: next.variant ?? variantValue,
      language: next.language ?? languageValue,
    };
    const exact = product.skus.find((sku) =>
      sku.condition === target.condition &&
      sku.variant === target.variant &&
      sku.language === target.language,
    );
    const fallback = product.skus.find((sku) =>
      sku.condition === target.condition &&
      sku.variant === target.variant,
    ) ?? product.skus.find((sku) => sku.condition === target.condition) ?? product.skus[0];
    props.onSkuChange((exact ?? fallback)?.id ?? "");
  };
  return (
    <section className="rounded-[28px] border border-white/[0.07] bg-[#06141f] p-4 sm:p-5">
      <div className="grid gap-5 2xl:grid-cols-[240px_minmax(420px,1fr)_280px]">
        <div>
          <ProductImage product={product} size="large" />
          <div className="mt-3 rounded-2xl border border-white/[0.06] bg-black/15 p-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Market sources</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {product.marketSources.map((source) => (
                <span key={source} className="rounded-full bg-white/[0.05] px-2 py-1 text-[9px] font-semibold text-slate-400">{source}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-300/[0.1] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-200">{product.gameLabel}</span>
            <span className="rounded-full bg-white/[0.055] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">{product.productType === "sealed" ? "Sealed product" : "Single"}</span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">{product.name}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {[product.setName, product.setCode, product.collectorNumber ? `#${product.collectorNumber}` : null, product.rarity].filter(Boolean).join(" · ") || "Exact product identity"}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-1 xl:grid-cols-3">
            <Metric label="Market" value={money(props.sku?.marketPrice ?? product.marketPrice) ?? "Unavailable"} />
            <Metric label="Low" value={money(props.sku?.lowPrice ?? product.lowPrice) ?? "Unavailable"} />
            <Metric label="Listings" value={String(props.sku?.activeListings ?? product.activeListings ?? "N/A")} />
          </div>

          <p className="mt-6 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">SKU details</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-1 xl:grid-cols-2">
            {product.productType === "card" ? (
              <>
                <Control label="Condition">
                  <select value={conditionValue} onChange={(event) => chooseSku({ condition: event.target.value })} className={FIELD_CLASS}>
                    {conditionOptions.length ? conditionOptions.map((condition) => (
                      <option key={condition} value={condition}>{condition}</option>
                    )) : <option value="">Unavailable</option>}
                  </select>
                </Control>
                <Control label="Variant">
                  <select value={variantValue} onChange={(event) => chooseSku({ variant: event.target.value })} className={FIELD_CLASS}>
                    {(variantOptions.length ? variantOptions : product.variants).map((variant) => <option key={variant} value={variant}>{variant}</option>)}
                  </select>
                </Control>
                <Control label="Language">
                  <select value={languageValue} onChange={(event) => chooseSku({ language: event.target.value })} className={FIELD_CLASS}>
                    {languageOptions.length ? languageOptions.map((language) => <option key={language} value={language}>{language}</option>) : <option value="English">English</option>}
                  </select>
                </Control>
              </>
            ) : (
              <Control label="Product type">
                <input readOnly value={product.productFamily ?? "Sealed product"} className={FIELD_CLASS} />
              </Control>
            )}
            <Control label="Quantity">
              <input type="number" min={1} value={props.quantity} onChange={(event) => props.onQuantityChange(Number(event.target.value))} className={FIELD_CLASS} />
            </Control>
            <Control label="Storage location">
              <select value={props.storageLocationId} onChange={(event) => props.onStorageLocationChange(event.target.value)} className={FIELD_CLASS}>
                <option value="">Unassigned</option>
                {props.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
            </Control>
          </div>
        </div>

        <aside className="rounded-[24px] bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-300">Buying</p>
            <Link href="/dashboard/buying-rules" className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500 transition hover:text-cyan-200">
              Edit rules
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            <BuyingRow label="Market reference" value={money(props.offer.marketReference)} />
            <BuyingRow label="Rule" value={props.buyingRulesLoading ? "Loading..." : props.buyingRule?.label ?? "Not configured"} />
            <BuyingRow label="Rule source" value={props.buyingRule?.sourceLabel ?? "Set Buying Rule"} />
            <BuyingRow label="Cash offer" value={money(props.offer.cashOffer)} strong />
            <BuyingRow label="Store credit" value={money(props.offer.storeCreditOffer)} />
            <BuyingRow label="Spread" value={money(props.offer.spread)} />
          </div>
          {!hasExactSku || props.addToPurchaseDisabledReason ? (
            <p className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-[10px] leading-5 text-amber-100/80">
              {props.addToPurchaseDisabledReason ?? "Confirm exact SKU pricing before finalizing an offer."}
            </p>
          ) : null}
          <button type="button" onClick={props.onAddPurchase} disabled={Boolean(props.addToPurchaseDisabledReason)} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 text-[10px] font-black uppercase tracking-[0.12em] text-[#021018] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">
            <ShoppingCart className="h-4 w-4" />
            Add to Purchase
          </button>
          <button type="button" onClick={() => props.onProductAction("add-inventory")} disabled={props.productActionSaving === "add-inventory"} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 transition hover:border-cyan-300/20 hover:text-cyan-200 disabled:opacity-50">
            {props.productActionSaving === "add-inventory" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
            Add to Inventory
          </button>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <SecondaryProductAction label="Collection" action="add-collection" saving={props.productActionSaving} onClick={props.onProductAction} />
            <SecondaryProductAction label="Wishlist" action="add-wishlist" saving={props.productActionSaving} onClick={props.onProductAction} />
            <SecondaryProductAction label="Trade Binder" action="add-trade-binder" saving={props.productActionSaving} onClick={props.onProductAction} />
            <SecondaryProductAction label="Binder" action="add-binder" saving={props.productActionSaving} onClick={props.onProductAction} disabled={!props.storageLocationId} title={!props.storageLocationId ? "Choose a storage or binder location first." : undefined} />
          </div>
          <Link href="/dashboard/market-intelligence" className="mt-3 flex h-10 items-center justify-center rounded-2xl text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:bg-white/[0.035] hover:text-cyan-200">
            View Market
          </Link>
        </aside>
      </div>
    </section>
  );
}

function SecondaryProductAction(props: {
  label: string;
  action: ProductAction;
  saving: ProductAction | null;
  onClick: (action: ProductAction) => void;
  disabled?: boolean;
  title?: string;
}) {
  const loading = props.saving === props.action;
  return (
    <button
      type="button"
      title={props.title}
      onClick={() => props.onClick(props.action)}
      disabled={props.disabled || loading}
      className="flex h-9 items-center justify-center rounded-xl border border-white/[0.06] px-2 text-[9px] font-black uppercase tracking-[0.08em] text-slate-400 transition hover:border-cyan-300/20 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : props.label}
    </button>
  );
}

function PurchaseCartPanel(props: {
  lines: PurchaseWorkspaceLine[];
  units: number;
  total: number;
  saving: boolean;
  onSave: () => void;
  onClear: () => void;
  onRemove: (id: string) => void;
  onQuantity: (id: string, quantity: number) => void;
}) {
  return (
    <aside className="rounded-[26px] border border-white/[0.07] bg-[#06141f] p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-cyan-300">Current purchase</p>
          <h2 className="mt-2 text-2xl font-semibold">{money(props.total) ?? "$0.00"}</h2>
          <p className="mt-1 text-xs text-slate-600">{props.units} units · {props.lines.length} items</p>
        </div>
        <WalletCards className="h-5 w-5 text-cyan-300" />
      </div>
      <div className="mt-4 space-y-2">
        {!props.lines.length ? (
          <EmptyState title="No purchase lines" detail="Add selected products here before reviewing the draft purchase." compact />
        ) : props.lines.map((line) => (
          <div key={line.id} className="rounded-2xl border border-white/[0.055] bg-white/[0.018] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{line.product.name}</p>
                <p className="mt-1 text-[9px] text-slate-600">
                  {line.product.gameLabel} · {line.product.productType === "sealed" ? "Sealed" : line.sku?.condition ?? "Single"} · {line.sku?.variant ?? line.product.variants[0] ?? "Default"} · {line.sku?.language ?? "English"}
                </p>
                <p className="mt-1 text-[9px] text-slate-600">
                  {line.offerPercent == null ? "Rule N/A" : `Rule ${line.offerPercent}%`} · Market {money(line.marketReference) ?? "Unavailable"}
                </p>
              </div>
              <button type="button" aria-label={`Remove ${line.product.name}`} onClick={() => props.onRemove(line.id)} className="rounded-lg p-1 text-slate-600 transition hover:bg-white/[0.05] hover:text-red-300">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <input type="number" min={1} value={line.quantity} onChange={(event) => props.onQuantity(line.id, Number(event.target.value))} className="h-8 w-20 rounded-lg border border-white/[0.08] bg-black/20 px-2 text-xs text-white outline-none" />
              <p className="text-xs font-semibold text-cyan-200">{money(line.unitOffer * line.quantity)}</p>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={props.onSave} disabled={!props.lines.length || props.saving} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 text-[10px] font-black uppercase tracking-[0.12em] text-[#021018] disabled:cursor-not-allowed disabled:opacity-40">
        {props.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Review Purchase
      </button>
      <button type="button" onClick={props.onClear} disabled={!props.lines.length} className="mt-2 h-10 w-full rounded-2xl border border-white/[0.08] text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 transition hover:text-slate-200 disabled:opacity-40">
        Clear purchase
      </button>
    </aside>
  );
}

function ProductImage({ product, size }: { product: PurchasingLookupResult; size: "small" | "large" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.imageUrl]);
  const className = size === "large" ? "aspect-[3/4] w-full rounded-[24px]" : "h-24 w-16 rounded-xl";
  return (
    <div className={`relative shrink-0 overflow-hidden bg-[#020914] ${className}`}>
      {product.imageUrl && !failed ? (
        <Image src={product.imageUrl} alt={product.name} fill unoptimized sizes={size === "large" ? "240px" : "64px"} className="object-contain" onError={() => setFailed(true)} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
          {product.productType === "sealed" ? <Boxes className="h-5 w-5 text-cyan-300/70" /> : <Layers3 className="h-5 w-5 text-cyan-300/70" />}
          <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">Image unavailable</span>
        </div>
      )}
    </div>
  );
}

function SegmentedProductType({ value, onChange }: { value: "all" | PurchasingProductType; onChange: (value: "all" | PurchasingProductType) => void }) {
  return (
    <div className="inline-flex h-11 rounded-2xl border border-white/[0.08] bg-black/20 p-1" role="group" aria-label="Product type">
      {(["all", "card", "sealed"] as const).map((item) => (
        <button key={item} type="button" aria-pressed={value === item} onClick={() => onChange(item)} className={`rounded-xl px-3 text-[10px] font-black uppercase tracking-[0.09em] transition ${value === item ? "bg-cyan-300 text-[#031319]" : "text-slate-500 hover:text-slate-200"}`}>
          {item === "card" ? "Singles" : item === "sealed" ? "Sealed" : "All"}
        </button>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-black/20 p-3">
      <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-slate-600">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function Control({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function uniqueSkuValues(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim()))).sort((left, right) => left.localeCompare(right));
}

function addToPurchaseDisabledReason(input: {
  product: PurchasingLookupResult;
  sku: PurchasingSkuOption | null;
  quantity: number;
  offer: ReturnType<typeof calculateBuyingOffer>;
  rule: EffectiveBuyingRule | null;
}) {
  if (!Number.isFinite(input.quantity) || input.quantity < 1) return "Enter a quantity greater than zero.";
  if (!input.rule || input.rule.percent == null) return "Set Buying Rule before adding to purchase.";
  if (input.product.productType === "card" && !input.sku) return "Select an exact variant before adding to purchase.";
  if (input.product.productType === "card" && input.sku?.marketPrice == null && input.sku?.lowPrice == null) {
    return "Select a priced variant before adding to purchase.";
  }
  if (input.product.productType === "sealed" && input.product.marketPrice == null && input.product.lowPrice == null) {
    return "Select a sealed product with market pricing before adding to purchase.";
  }
  if (input.offer.cashOffer == null && !input.rule.manualOfferAllowed) return "Offer could not be calculated from the current market and buying rule.";
  return null;
}

function BuyingRow({ label, value, strong = false }: { label: string; value: string | null; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? "text-lg font-semibold text-cyan-200" : "font-semibold text-slate-200"}>{value ?? "N/A"}</span>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5">{label}</span>;
}

function Status({ message, tone }: { message: string; tone: "error" | "success" }) {
  return (
    <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${tone === "error" ? "border-red-300/15 bg-red-300/[0.05] text-red-100" : "border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-100"}`}>
      {message}
    </div>
  );
}

function productActionNotice(action: ProductAction, merged: boolean) {
  if (action === "add-wishlist") return "Product added to Wishlist.";
  if (action === "add-trade-binder") return merged ? "Existing inventory marked available in Trade Binder." : "Product added and marked available in Trade Binder.";
  if (action === "add-binder") return merged ? "Existing inventory moved to the selected binder or storage location." : "Product added to the selected binder or storage location.";
  if (action === "add-collection") return merged ? "Existing collection quantity increased." : "Product added to Collection.";
  return merged ? "Existing inventory quantity increased." : "Product added to inventory.";
}

function EmptyState({ title, detail, compact = false }: { title: string; detail: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-dashed border-white/[0.08] text-center ${compact ? "p-4" : "p-8"}`}>
      <SlidersHorizontal className="mx-auto h-5 w-5 text-slate-700" />
      <p className="mt-3 text-sm font-semibold text-slate-300">{title}</p>
      <p className="mt-1 text-[10px] leading-5 text-slate-600">{detail}</p>
    </div>
  );
}

function money(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : null;
}
