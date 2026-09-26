"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Filter, Search, ShoppingBag, X } from "lucide-react";
import type { ShowcaseCard, ShowcaseFacets, ShowcaseProfile } from "@/lib/showcase";
import type { StorefrontQuery } from "@/lib/storefront/query";
import {
  addCartLine, cartLineKey, cartStorageKey, parseStorefrontCart, removeCartLine,
  setCartQuantity, validateCartSubtotal, type CartValidation, type StorefrontCart,
} from "@/lib/storefront/cart";
import { ShowcaseCardImage } from "@/components/showcase/ShowcaseCardImage";

type Props = {
  store: ShowcaseProfile;
  cards: ShowcaseCard[];
  total: number;
  facets: ShowcaseFacets;
  cartStoreSlug: string;
  previousHref: string | null;
  nextHref: string | null;
  page: number;
  pageCount: number;
  query: StorefrontQuery;
};

const serverCart: StorefrontCart = { version: 1, lines: [] };
const cartSnapshots = new Map<string, { raw: string | null; cart: StorefrontCart }>();
const CART_CHANGED = "trading-docks-storefront-cart-changed";

function readCartSnapshot(storeSlug: string): StorefrontCart {
  const key = cartStorageKey(storeSlug);
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(key); } catch { raw = cartSnapshots.get(key)?.raw ?? null; }
  const cached = cartSnapshots.get(key);
  if (cached?.raw === raw) return cached.cart;
  const cart = parseStorefrontCart(raw, storeSlug);
  cartSnapshots.set(key, { raw, cart });
  return cart;
}

function subscribeCart(storeSlug: string, onChange: () => void) {
  const key = cartStorageKey(storeSlug);
  const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) onChange(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CART_CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CART_CHANGED, onChange);
  };
}

function updateStoredCart(storeSlug: string, update: (cart: StorefrontCart) => StorefrontCart) {
  const key = cartStorageKey(storeSlug);
  const cart = update(readCartSnapshot(storeSlug));
  const raw = JSON.stringify(cart);
  try { window.localStorage.setItem(key, raw); } catch { /* In-memory snapshot still supports this page. */ }
  cartSnapshots.set(key, { raw, cart });
  window.dispatchEvent(new Event(CART_CHANGED));
}

const FILTERS = [
  ["game", "Game"], ["set", "Set"], ["cardType", "Card type"], ["color", "Color"],
  ["rarity", "Rarity"], ["finish", "Finish"], ["condition", "Condition"],
  ["language", "Language"], ["tag", "Store tags"],
] as const;

function formatMoney(value: number | null) {
  return value === null || !Number.isFinite(value)
    ? "Price not set"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function currentProduct(card: ShowcaseCard, priceVisible: boolean, quantityVisible: boolean): CartValidation {
  return {
    listingPrice: card.storefront_listing_price,
    availableQuantity: card.available_quantity,
    name: card.name,
    setName: card.set_name ?? card.set_code,
    collectorNumber: card.collector_number,
    condition: card.condition,
    finish: card.finish,
    language: card.language,
    imageUrl: card.image_url,
    priceVisible,
    quantityVisible,
    isAvailable: card.available_quantity > 0,
  };
}

export function StorefrontExperience(props: Props) {
  const { store, cards, total, facets, cartStoreSlug, previousHref, nextHref, page, pageCount, query } = props;
  const router = useRouter();
  const cart = useSyncExternalStore(
    (onChange) => subscribeCart(cartStoreSlug, onChange),
    () => readCartSnapshot(cartStoreSlug),
    () => serverCart,
  );
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [validationState, setValidationState] = useState<{ signature: string; status: "idle" | "loading" | "ready" | "error"; values: Map<string, CartValidation>; error: string | null }>({ signature: "", status: "idle", values: new Map(), error: null });
  const [detailCard, setDetailCard] = useState<ShowcaseCard | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => { setPortalRoot(document.body); }, []);

  const lineCount = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
  const cartSignature = JSON.stringify(cart.lines.map(({ publicId, storeSlug, quantity }) => [publicId, storeSlug, quantity]));
  const currentValidation = validationState.signature === cartSignature ? validationState : { signature: cartSignature, status: "idle" as const, values: new Map<string, CartValidation>(), error: null };
  const validated = currentValidation.values;
  const revalidating = currentValidation.status === "loading";
  const revalidationError = currentValidation.error;
  const cartSubtotal = validateCartSubtotal(cart.lines, validated);

  useEffect(() => {
    let cancelled = false;
    const validate = async () => {
      await Promise.resolve();
      if (cart.lines.length === 0) {
        if (!cancelled) setValidationState({ signature: cartSignature, status: "ready", values: new Map(), error: null });
        return;
      }
      if (!cancelled) setValidationState({ signature: cartSignature, status: "loading", values: new Map(), error: null });
      try {
        const found = new Map<string, CartValidation>();
        const ids = cart.lines.filter((line) => line.storeSlug === cartStoreSlug).map((line) => line.publicId);
        for (let start = 0; start < ids.length; start += 40) {
          const params = new URLSearchParams({ store: cartStoreSlug });
          ids.slice(start, start + 40).forEach((id) => params.append("id", id));
          const response = await fetch(`/api/storefront/catalog?${params.toString()}`, { cache: "no-store" });
          if (!response.ok) throw new Error("Cart availability is temporarily unavailable.");
          const result = await response.json() as { items?: ShowcaseCard[]; profile?: { show_prices?: boolean; show_quantities?: boolean } };
          for (const card of result.items ?? []) found.set(cartLineKey({ publicId: card.public_id, storeSlug: cartStoreSlug }), currentProduct(card, result.profile?.show_prices !== false, result.profile?.show_quantities !== false));
        }
        if (!cancelled) setValidationState({ signature: cartSignature, status: "ready", values: found, error: null });
      } catch (error) {
        if (!cancelled) setValidationState({ signature: cartSignature, status: "error", values: new Map(), error: error instanceof Error ? error.message : "Cart availability is temporarily unavailable." });
      }
    };
    void validate();
    return () => { cancelled = true; };
  }, [cart.lines, cartSignature, cartStoreSlug]);

  function add(card: ShowcaseCard) {
    if (card.storefront_listing_price === null || card.available_quantity < 1) return;
    updateStoredCart(cartStoreSlug, (current) => addCartLine(current, card.public_id, cartStoreSlug, card.available_quantity));
    setAddedId(card.public_id);
    window.setTimeout(() => setAddedId((current) => current === card.public_id ? null : current), 1500);
  }

  function removeFilter(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    const remaining = params.getAll(key).filter((item) => item !== value);
    params.delete(key);
    remaining.forEach((item) => params.append(key, item));
    params.delete("page");
    router.push(params.size ? `/shop?${params.toString()}` : "/shop");
  }

  const suggestions = useMemo(() => [...new Set(cards.flatMap((card) => [card.name, card.set_name, ...card.custom_tags]).filter((value): value is string => Boolean(value)))].slice(0, 100), [cards]);

  return <main className="min-h-screen overflow-x-hidden bg-[#071017] text-white">
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#071017]/95 px-4 py-4 backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
        <a href="/shop" className="flex min-w-0 items-center gap-3" aria-label="Trading Docks Store home">
          {store.logo_url ? <img src={store.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300 font-black text-slate-950">TD</span>}
          <span className="min-w-0"><span className="block truncate font-semibold">{store.display_name}</span><span className="block text-xs text-white/45">Trading Docks Store</span></span>
        </a>
        <button onClick={() => setCartOpen(true)} className="relative inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold hover:bg-white/5" aria-label={`Open cart, ${lineCount} items`}>
          <ShoppingBag className="h-4 w-4 text-cyan-200" /> Cart <span className="rounded-full bg-cyan-300 px-2 py-0.5 text-xs font-bold text-slate-950">{lineCount}</span>
        </button>
      </div>
    </header>

    <section className="mx-auto max-w-[1440px] px-4 pb-6 pt-9 sm:px-8 sm:pt-12">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-200">Trading card singles</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">Find the card you want.</h1>
      {store.description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">{store.description}</p> : null}
      <form action="/shop" method="get" className="mt-7 flex max-w-3xl items-center gap-2 rounded-2xl border border-white/15 bg-white/[.05] p-2">
        <Search className="ml-2 h-5 w-5 shrink-0 text-white/45" />
        <input name="q" defaultValue={query.q} list="storefront-suggestions" placeholder="Search card, set, number, type, color, or tag" aria-label="Search store inventory" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none placeholder:text-white/35" />
        <datalist id="storefront-suggestions">{suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
        {Object.entries(query.filters).flatMap(([key, value]) => Array.isArray(value) ? value.map((entry) => <input key={`${key}-${entry}`} type="hidden" name={key} value={entry} />) : value ? <input key={key} type="hidden" name={key} value={value} /> : [])}
        {query.sort !== "relevance" ? <input type="hidden" name="sort" value={query.sort} /> : null}
        <button className="min-h-11 rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950">Search</button>
      </form>
    </section>

    <div className="mx-auto grid max-w-[1440px] gap-6 px-4 pb-16 sm:px-8 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside>
        <details className="rounded-2xl border border-white/10 bg-white/[.035] p-4 lg:sticky lg:top-24 lg:block" open>
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold lg:pointer-events-none"><Filter className="h-4 w-4 text-cyan-200" /> Filters</summary>
          <form action="/shop" method="get" className="mt-4 space-y-4">
            {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
            <input type="hidden" name="sort" value={query.sort} />
            {FILTERS.map(([key, label]) => {
              const options = facets[key] ?? [];
              if (!options.length) return null;
              const active = query.filters[key] ?? [];
              return <fieldset key={key} className="border-t border-white/10 pt-3">
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/65">{label}</legend>
                <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                  {options.slice(0, 30).map(({ value, count }) => <label key={value} className="flex min-h-8 cursor-pointer items-center gap-2 text-sm text-white/75">
                    <input type="checkbox" name={key} value={value} defaultChecked={active.some((selected) => selected.toLowerCase() === value.toLowerCase())} className="h-4 w-4 accent-cyan-300" />
                    <span className="min-w-0 flex-1 truncate">{value}</span><span className="text-xs text-white/35">{count}</span>
                  </label>)}
                </div>
              </fieldset>;
            })}
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-white/60">Min price<input aria-label="Minimum price" name="minPrice" type="number" min="0" step="0.01" defaultValue={query.filters.minPrice} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0d1a25] px-2 py-2 text-sm text-white" /></label>
              <label className="text-xs text-white/60">Max price<input aria-label="Maximum price" name="maxPrice" type="number" min="0" step="0.01" defaultValue={query.filters.maxPrice} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0d1a25] px-2 py-2 text-sm text-white" /></label>
            </div>
            <label className="flex min-h-9 items-center gap-2 text-sm text-white/75"><input type="checkbox" name="inStock" value="false" defaultChecked={query.filters.inStock === "false"} className="h-4 w-4 accent-cyan-300" /> Include out of stock</label>
            <div className="flex gap-2"><button className="min-h-10 flex-1 rounded-lg bg-cyan-300 px-3 text-sm font-bold text-slate-950">Apply filters</button><a href={query.q ? `/shop?q=${encodeURIComponent(query.q)}` : "/shop"} className="inline-flex min-h-10 items-center rounded-lg border border-white/15 px-3 text-sm">Clear all</a></div>
          </form>
        </details>
      </aside>

      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-white/55">{total.toLocaleString()} {total === 1 ? "card" : "cards"} found</p>
          <label className="flex items-center gap-2 text-xs text-white/55">Sort
            <select name="sort" form="sort-form" defaultValue={query.sort} onChange={(event) => event.currentTarget.form?.requestSubmit()} className="min-h-10 rounded-lg border border-white/15 bg-[#0d1a25] px-3 text-sm text-white">
              <option value="relevance">Relevance</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="newest">Newest added</option><option value="name">Name A–Z</option>
            </select>
            <form id="sort-form" action="/shop" method="get">{query.q ? <input type="hidden" name="q" value={query.q} /> : null}{Object.entries(query.filters).flatMap(([key,value]) => Array.isArray(value) ? value.map((entry) => <input key={`${key}-${entry}`} type="hidden" name={key} value={entry} />) : value ? <input key={key} type="hidden" name={key} value={value} /> : [])}</form>
          </label>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(query.filters).flatMap(([key, value]) => Array.isArray(value) ? value.map((entry) => <button key={`${key}-${entry}`} onClick={() => removeFilter(key, entry)} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 text-xs text-cyan-100">{entry}<X className="h-3 w-3" /></button>) : value && key !== "inStock" ? <button key={key} onClick={() => removeFilter(key, value)} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 text-xs text-cyan-100">{key === "minPrice" ? `Min $${value}` : `Max $${value}`}<X className="h-3 w-3" /></button> : [])}
          {query.filters.inStock === "false" ? <button onClick={() => removeFilter("inStock", "false")} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 text-xs text-cyan-100">Include out of stock<X className="h-3 w-3" /></button> : null}
        </div>
        {cards.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {cards.map((card) => <article key={card.public_id} className="group min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[.045] transition hover:-translate-y-0.5 hover:border-cyan-200/30">
            <button type="button" onClick={() => setDetailCard(card)} className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200" aria-label={`View ${card.name} details`}>
              <div className="aspect-[5/7] bg-[#0d202b]"><ShowcaseCardImage card={card} alt={`${card.name} trading card`} /></div>
              <div className="p-3"><h2 className="truncate text-sm font-semibold">{card.name}</h2><p className="mt-1 truncate text-xs text-white/50">{[card.set_name ?? card.set_code, card.collector_number].filter(Boolean).join(" · ") || "Card"}</p><p className="mt-1 truncate text-xs text-white/45">{[card.condition, card.finish, card.language].filter(Boolean).join(" · ")}</p>
                <div className="mt-3 flex flex-wrap gap-1">{[card.rarity, card.card_type, ...card.colors.slice(0, 2), ...card.custom_tags.slice(0, 1)].filter(Boolean).slice(0, 3).map((tag) => <span key={tag} className="max-w-full truncate rounded-full bg-white/[.08] px-2 py-1 text-[10px] text-white/65">{tag}</span>)}</div>
              </div>
            </button>
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3"><span className="text-sm font-semibold text-cyan-100">{store.show_prices ? formatMoney(card.storefront_listing_price) : "Price hidden"}</span><button type="button" disabled={card.storefront_listing_price === null || card.available_quantity < 1} onClick={() => add(card)} className="min-h-10 shrink-0 rounded-lg bg-cyan-300 px-3 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">{addedId === card.public_id ? <Check className="h-4 w-4" /> : "Add to cart"}</button></div>
            <p className="px-3 pb-3 text-[11px] text-white/40">{card.storefront_listing_price === null ? (store.show_prices ? "Price not set" : "Price hidden") : card.available_quantity > 0 ? (store.show_quantities ? `${card.available_quantity} available` : "In stock") : "Out of stock"}</p>
          </article>)}
        </div> : <div className="rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center"><h2 className="text-lg font-semibold">No matching cards</h2><p className="mt-2 text-sm text-white/55">Try another name, remove a filter, or clear all filters.</p><a href="/shop" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-cyan-300 px-4 font-bold text-slate-950">Browse all cards</a></div>}
        <div className="mt-7 flex items-center justify-between"><a aria-disabled={!previousHref} href={previousHref ?? undefined} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 ${previousHref ? "" : "pointer-events-none opacity-35"}`}><ArrowLeft className="h-4 w-4" /> Previous</a><span className="text-xs text-white/45">Page {page} of {pageCount}</span><a aria-disabled={!nextHref} href={nextHref ?? undefined} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 ${nextHref ? "" : "pointer-events-none opacity-35"}`}>Next <ArrowRight className="h-4 w-4" /></a></div>
      </section>
    </div>

    {detailCard && portalRoot ? createPortal(<div className="fixed inset-0 z-40 grid place-items-center bg-black/75 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailCard(null); }}><section role="dialog" aria-modal="true" aria-labelledby="product-title" className="grid max-h-[90vh] w-full max-w-3xl gap-5 overflow-y-auto rounded-3xl border border-white/10 bg-[#0b1821] p-5 sm:grid-cols-[minmax(180px,.8fr)_1.2fr] sm:p-7"><div className="mx-auto w-full max-w-[260px]"><div className="aspect-[5/7] overflow-hidden rounded-xl bg-black/20"><ShowcaseCardImage card={detailCard} alt={`${detailCard.name} card image`} /></div></div><div><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-200">Card details</p><h2 id="product-title" className="mt-2 text-2xl font-semibold">{detailCard.name}</h2></div><button onClick={() => setDetailCard(null)} aria-label="Close product details" className="rounded-lg p-2 hover:bg-white/10"><X /></button></div><dl className="mt-5 grid grid-cols-2 gap-3 text-sm">{[["Game",detailCard.game],["Set",detailCard.set_name ?? detailCard.set_code],["Collector number",detailCard.collector_number],["Type",detailCard.type_line],["Color",detailCard.colors.join(", ")],["Rarity",detailCard.rarity],["Finish",detailCard.finish],["Condition",detailCard.condition],["Language",detailCard.language],["Store tags",detailCard.custom_tags.join(", ")]].map(([label,value]) => <div key={label} className="min-w-0 rounded-xl bg-white/[.04] p-3"><dt className="text-xs text-white/45">{label}</dt><dd className="mt-1 break-words">{value || "Not recorded"}</dd></div>)}</dl><p className="mt-5 text-xl font-bold text-cyan-100">{store.show_prices ? formatMoney(detailCard.storefront_listing_price) : "Price hidden"}</p><p className="mt-1 text-sm text-white/50">{store.show_quantities ? `${detailCard.available_quantity} available` : detailCard.available_quantity > 0 ? "In stock" : "Out of stock"}</p><button disabled={detailCard.storefront_listing_price === null || detailCard.available_quantity < 1} onClick={() => add(detailCard)} className="mt-5 min-h-12 w-full rounded-xl bg-cyan-300 font-bold text-slate-950 disabled:opacity-40">Add to cart</button></div></section></div>, portalRoot) : null}

    {cartOpen && portalRoot ? createPortal(<div className="fixed inset-0 z-50 bg-black/75 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}><aside role="dialog" aria-modal="true" aria-labelledby="cart-title" className="ml-auto flex h-full w-full max-w-lg flex-col rounded-3xl border border-white/10 bg-[#0b1821] p-5 shadow-2xl sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-200">Your saved cart</p><h2 id="cart-title" className="mt-1 text-xl font-semibold">{lineCount} {lineCount === 1 ? "card" : "cards"}</h2></div><button onClick={() => setCartOpen(false)} aria-label="Close cart" className="rounded-lg p-2 hover:bg-white/10"><X /></button></div>
      {revalidating ? <p className="mt-3 text-xs text-cyan-100" role="status">Refreshing current prices and availability…</p> : null}
      {revalidationError ? <p className="mt-3 rounded-xl bg-amber-300/10 p-3 text-sm text-amber-100" role="alert">{revalidationError} Your saved cart is preserved. Try refreshing before adjusting availability.</p> : null}
      <div className="mt-5 flex-1 space-y-3 overflow-y-auto">{cart.lines.length ? cart.lines.map((line) => {
        const item = validated.get(cartLineKey(line));
        const available = item?.availableQuantity ?? 0;
        return <article key={cartLineKey(line)} className="flex gap-3 rounded-2xl border border-white/10 p-3">
          <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-black/20">{item?.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center text-xs text-white/35">Card</div>}</div>
          <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{item?.name ?? "Checking saved card…"}</h3><p className="mt-1 text-xs text-white/50">{[item?.setName,item?.collectorNumber,item?.condition,item?.finish,item?.language].filter(Boolean).join(" · ")}</p><p className="mt-2 text-sm text-cyan-100">Current storefront price: {item?.priceVisible === false ? "Price hidden" : formatMoney(item?.listingPrice ?? null)}</p>
            {!revalidating && !revalidationError && currentValidation.status === "ready" && (!item || !item.isAvailable) ? <p className="mt-1 text-xs text-rose-200">This card is no longer available. Remove it to clear this notice.</p> : null}
            {item && item.listingPrice === null ? <p className="mt-1 text-xs text-amber-100">Price not set. This card cannot be added as a purchasable item.</p> : null}
            {item && item.isAvailable && item.quantityVisible && line.quantity > available ? <p className="mt-1 text-xs text-amber-100">Requested: {line.quantity} · Available now: {available}. Adjust quantity to continue planning.</p> : null}
            {item && item.isAvailable && !item.quantityVisible ? <p className="mt-1 text-xs text-white/45">Stock counts are hidden by this store; this saved cart does not reserve inventory.</p> : null}
            {item && !item.isAvailable ? <button onClick={() => updateStoredCart(cartStoreSlug, (current) => removeCartLine(current, line.publicId))} className="mt-2 min-h-9 text-xs text-rose-200 underline">Remove unavailable card</button> : <div className="mt-2 flex items-center gap-2"><label className="text-xs text-white/50">Qty<input aria-label={`Quantity for ${item?.name ?? "card"}`} type="number" min="1" max={item?.quantityVisible ? Math.max(1, Math.min(999, available)) : 999} value={line.quantity} onChange={(event) => { const quantity = Number(event.target.value); if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 999 && (!item?.quantityVisible || quantity <= available)) updateStoredCart(cartStoreSlug, (current) => setCartQuantity(current, line.publicId, quantity)); }} className="ml-2 h-9 w-20 rounded-lg border border-white/15 bg-[#0d1a25] px-2 text-sm text-white" /></label><button onClick={() => updateStoredCart(cartStoreSlug, (current) => removeCartLine(current, line.publicId))} className="min-h-9 px-2 text-xs text-white/50 underline">Remove</button></div>}
          </div>
        </article>;
      }) : <p className="rounded-2xl border border-dashed border-white/15 p-7 text-center text-sm text-white/50">Your cart is empty. Add a card to save it here.</p>}</div>
      <div className="border-t border-white/10 pt-4"><div className="flex justify-between text-sm"><span className="text-white/55">Current storefront subtotal</span><strong>{formatMoney(cartSubtotal)}</strong></div><p className="mt-3 text-xs leading-5 text-white/45">This cart is saved on this browser and is for planning only. It does not reserve cards, submit a request, create an order, or collect payment. Checkout is coming later.</p><div className="mt-4 flex gap-2"><button disabled={!cart.lines.length} onClick={() => updateStoredCart(cartStoreSlug, () => ({ version: 1, lines: [] }))} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm disabled:opacity-40">Clear cart</button><button onClick={() => setCartOpen(false)} className="min-h-11 flex-1 rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950">Continue browsing</button></div></div>
    </aside></div>, portalRoot) : null}
  </main>;
}
