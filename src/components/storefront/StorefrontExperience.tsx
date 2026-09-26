"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Moon, Search, ShoppingBag, SlidersHorizontal, Sun, X } from "lucide-react";
import type { ShowcaseCard, ShowcaseFacets, ShowcaseProfile } from "@/lib/showcase";
import type { StorefrontQuery } from "@/lib/storefront/query";
import {
  addCartLine, cartLineKey, cartStorageKey, parseStorefrontCart, removeCartLine,
  setCartQuantity, validateCartSubtotal, type CartValidation, type StorefrontCart,
} from "@/lib/storefront/cart";
import { useTheme } from "next-themes";
import { useHydrated } from "@/hooks/use-hydrated";
import { StorefrontImage } from "./StorefrontImage";
import { StorefrontDialog } from "./StorefrontDialog";
import styles from "./storefront.module.css";

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
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    if (!addedId || (currentValidation.status !== "ready" && currentValidation.status !== "error")) return;
    const timer = window.setTimeout(() => setAddedId(null), 1500);
    return () => window.clearTimeout(timer);
  }, [addedId, currentValidation.status]);

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

  const filterChips = [
    ...(query.q ? [{ key: "q", value: query.q, label: `Search: ${query.q}` }] : []),
    ...Object.entries(query.filters).flatMap(([key, value]) => Array.isArray(value)
      ? value.map((entry) => ({ key, value: entry, label: `${FILTERS.find(([name]) => name === key)?.[1] ?? key}: ${entry}` }))
      : value ? [{ key, value, label: key === "inStock" ? "Include out of stock" : `${key === "minPrice" ? "Min" : "Max"}: $${value}` }] : []),
  ];
  const dark = !hydrated || resolvedTheme !== "light";
  const addFeedback = (card: ShowcaseCard) => addedId === card.public_id
    ? revalidating ? <><LoaderCircle size={14} className={styles.spin} aria-hidden="true" /> Checking…</> : <><Check size={14} aria-hidden="true" /> Added</>
    : "Add to cart";

  return <main className={`${styles.theme} ${styles.page}`}>
    <a href="#catalog" className={styles.skip}>Skip to cards</a>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <a href="/shop" className={styles.brand} aria-label="Trading Docks Store home">
          {store.logo_url ? <img src={store.logo_url} alt="" /> : <span className={styles.brandMark}>TD</span>}
          <span className={styles.brandText}><strong>{store.display_name}</strong><small>Trading card singles</small></span>
        </a>
        <div className={styles.headerActions}>
          <button type="button" className={styles.iconButton} onClick={() => setTheme(dark ? "light" : "dark")} aria-label={`Switch to ${dark ? "light" : "dark"} theme`}>
            {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          <button type="button" onClick={() => setCartOpen(true)} className={styles.cartButton} aria-label={`Open cart, ${lineCount} items`}>
            <ShoppingBag size={17} aria-hidden="true" /> Cart <span>{lineCount}</span>
          </button>
        </div>
      </div>
    </header>

    <section className={styles.intro} aria-labelledby="store-title">
      <div><p className={styles.eyebrow}>The singles collection</p><h1 id="store-title">Your next great draw.</h1>
        {store.description ? <p className={styles.description}>{store.description}</p> : null}
      </div>
      <form key={query.q} action="/shop" method="get" className={styles.search} role="search">
        <Search size={18} aria-hidden="true" />
        <input name="q" defaultValue={query.q} list="storefront-suggestions" placeholder="Search cards or sets" aria-label="Search store inventory" />
        <datalist id="storefront-suggestions">{suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
        <FilterHiddenInputs query={query} />
        <input type="hidden" name="sort" value={query.sort} />
        <button className={styles.primary}>Search</button>
      </form>
    </section>

    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="Catalog filters">
        <h2>Filter collection</h2>
        <StorefrontFilters key={JSON.stringify(query)} query={query} facets={facets} />
      </aside>
      <section id="catalog" className={styles.results} aria-labelledby="catalog-title" tabIndex={-1}>
        <h2 id="catalog-title" className={styles.srOnly}>Browse cards</h2>
        <div className={styles.toolbar}>
          <p className={styles.resultCount}><strong>{total.toLocaleString()}</strong> {total === 1 ? "card" : "cards"}{filterChips.length ? " matching your search" : " in the collection"}</p>
          <div className={styles.toolbarControls}>
            <button type="button" className={styles.filterToggle} onClick={() => setFiltersOpen(true)} aria-haspopup="dialog"><SlidersHorizontal size={16} aria-hidden="true" /> Filters{filterChips.length ? ` (${filterChips.length})` : ""}</button>
            <form action="/shop" method="get">
              {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
              <FilterHiddenInputs query={query} />
              <label className={styles.sort}><span>Sort by</span><select name="sort" aria-label="Sort cards" defaultValue={query.sort} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
                <option value="relevance">Relevance</option><option value="price_asc">Price: low → high</option><option value="price_desc">Price: high → low</option><option value="name">Name A–Z</option><option value="newest">Newest added</option>
              </select></label>
            </form>
          </div>
        </div>
        {filterChips.length ? <div className={styles.chips} aria-label="Active filters">
          {filterChips.map(({ key, value, label }) => <button key={`${key}-${value}`} type="button" onClick={() => removeFilter(key, value)} className={styles.chip} aria-label={`Remove ${label}`}>{label}<X size={13} aria-hidden="true" /></button>)}
          <a href="/shop" className={styles.textLink}>Clear all</a>
        </div> : null}
        <p className={styles.srOnly} role="status" aria-live="polite">{addedId ? `${cards.find((card) => card.public_id === addedId)?.name ?? "Card"} added to your saved cart.${revalidating ? " Checking current availability." : ""}` : ""}</p>
        {cards.length ? <div className={styles.grid}>
          {cards.map((card) => <article key={card.public_id} className={styles.product}>
            <button type="button" onClick={() => setDetailCard(card)} className={styles.productLink} aria-label={`View ${card.name} details`}>
              <div className={styles.artwork}><StorefrontImage key={card.public_id} card={card} alt={`${card.name} — ${card.set_code?.toUpperCase() ?? card.set_name ?? ""} #${card.collector_number ?? ""}`} /></div>
              <div className={styles.productText}>
                <h3 title={card.name}>{card.name}</h3>
                <p className={styles.printing}><strong>{card.set_code?.toUpperCase() ?? card.set_name ?? "Set not recorded"}</strong>{card.collector_number ? <><span aria-hidden="true">·</span><span>#{card.collector_number}</span></> : null}</p>
                <p className={styles.condition}>{[card.condition, card.finish].filter(Boolean).join(" · ") || "Condition not recorded"}</p>
              </div>
            </button>
            <div className={styles.buy}>
              <span className={styles.price}>{store.show_prices ? formatMoney(card.storefront_listing_price) : "Price hidden"}</span>
              <p className={styles.availability}>{card.storefront_listing_price === null ? (store.show_prices ? "Price not set" : "Price hidden") : card.available_quantity > 0 ? (store.show_quantities ? `${card.available_quantity} available` : "In stock") : "Out of stock"}</p>
              <button type="button" className={styles.add} data-added={addedId === card.public_id} aria-busy={addedId === card.public_id && revalidating} disabled={card.storefront_listing_price === null || card.available_quantity < 1} onClick={() => add(card)}>{addFeedback(card)}</button>
            </div>
          </article>)}
        </div> : <div className={styles.empty}><h3>No matching cards</h3><p>Try another name or remove a filter to see more of the collection.</p><a href="/shop" className={styles.primary}>Browse all cards</a></div>}
        <nav className={styles.pagination} aria-label="Catalog pages">
          <a aria-disabled={!previousHref} href={previousHref ?? undefined} className={styles.secondary}><ArrowLeft size={15} aria-hidden="true" /> Previous</a>
          <span>Page {page} of {pageCount}</span>
          <a aria-disabled={!nextHref} href={nextHref ?? undefined} className={styles.secondary}>Next <ArrowRight size={15} aria-hidden="true" /></a>
        </nav>
      </section>
    </div>

    {filtersOpen && portalRoot ? createPortal(<StorefrontDialog variant="sheet" labelledBy="filter-title" onClose={() => setFiltersOpen(false)}>
      <div className={styles.dialogHeader}><div><p className={styles.eyebrow}>Refine your search</p><h2 id="filter-title">Filters</h2></div><button type="button" className={styles.iconButton} aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X size={20} aria-hidden="true" /></button></div>
      <div className={styles.sheetBody}><StorefrontFilters query={query} facets={facets} /></div>
    </StorefrontDialog>, portalRoot) : null}

    {detailCard && portalRoot ? createPortal(<StorefrontDialog labelledBy="product-title" onClose={() => setDetailCard(null)}>
      <div className={styles.dialogHeader}><div><p className={styles.eyebrow}>Card details</p><h2 id="product-title">{detailCard.name}</h2></div><button type="button" onClick={() => setDetailCard(null)} aria-label="Close product details" className={styles.iconButton}><X size={20} aria-hidden="true" /></button></div>
      <div className={styles.detailLayout}>
        <div className={styles.detailArtwork}><StorefrontImage key={detailCard.public_id} card={detailCard} alt={`${detailCard.name} card image`} /></div>
        <div><dl className={styles.detailFields}>{[["Game",detailCard.game],["Set",detailCard.set_name ?? detailCard.set_code?.toUpperCase()],["Collector number",detailCard.collector_number],["Type",detailCard.type_line],["Color",detailCard.colors.join(", ")],["Rarity",detailCard.rarity],["Finish",detailCard.finish],["Condition",detailCard.condition],["Language",detailCard.language],["Store tags",detailCard.custom_tags.join(", ")]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || "Not recorded"}</dd></div>)}</dl>
          <p className={styles.price}>{store.show_prices ? formatMoney(detailCard.storefront_listing_price) : "Price hidden"}</p>
          <p className={styles.availability}>{store.show_quantities ? `${detailCard.available_quantity} available` : detailCard.available_quantity > 0 ? "In stock" : "Out of stock"}</p>
          <button type="button" className={styles.add} disabled={detailCard.storefront_listing_price === null || detailCard.available_quantity < 1} aria-busy={addedId === detailCard.public_id && revalidating} data-added={addedId === detailCard.public_id} onClick={() => add(detailCard)}>{addFeedback(detailCard)}</button>
        </div>
      </div>
    </StorefrontDialog>, portalRoot) : null}

    {cartOpen && portalRoot ? createPortal(<StorefrontDialog variant="sheet" labelledBy="cart-title" onClose={() => setCartOpen(false)}>
      <div className={styles.dialogHeader}><div><p className={styles.eyebrow}>Your saved cart</p><h2 id="cart-title">{lineCount} {lineCount === 1 ? "card" : "cards"}</h2></div><button type="button" onClick={() => setCartOpen(false)} aria-label="Close cart" className={styles.iconButton}><X size={20} aria-hidden="true" /></button></div>
      {revalidating ? <p className={styles.notice} role="status">Refreshing current prices and availability…</p> : null}
      {revalidationError ? <p className={styles.notice} role="alert">{revalidationError} Your saved cart is preserved. Try refreshing before adjusting availability.</p> : null}
      <div className={`${styles.sheetBody} ${styles.cartLines}`}>{cart.lines.length ? cart.lines.map((line) => {
        const item = validated.get(cartLineKey(line));
        const available = item?.availableQuantity ?? 0;
        return <article key={cartLineKey(line)} className={styles.cartLine}>
          <div className={styles.cartArtwork}>{item?.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : <div>Card</div>}</div>
          <div className={styles.cartLineInfo}><h3>{item?.name ?? "Checking saved card…"}</h3><p className={styles.muted}>{[item?.setName,item?.collectorNumber,item?.condition,item?.finish,item?.language].filter(Boolean).join(" · ")}</p><p>Current storefront price: {item?.priceVisible === false ? "Price hidden" : formatMoney(item?.listingPrice ?? null)}</p>
            {!revalidating && !revalidationError && currentValidation.status === "ready" && (!item || !item.isAvailable) ? <p className={styles.notice}>This card is no longer available. Remove it to clear this notice.</p> : null}
            {item && item.listingPrice === null ? <p className={styles.notice}>Price not set. This card cannot be added as a purchasable item.</p> : null}
            {item && item.isAvailable && item.quantityVisible && line.quantity > available ? <p className={styles.notice}>Requested: {line.quantity} · Available now: {available}. Adjust quantity to continue planning.</p> : null}
            {item && item.isAvailable && !item.quantityVisible ? <p className={styles.muted}>Stock counts are hidden by this store; this saved cart does not reserve inventory.</p> : null}
            {item && !item.isAvailable ? <button type="button" onClick={() => updateStoredCart(cartStoreSlug, (current) => removeCartLine(current, line.publicId))} className={styles.textLink}>Remove unavailable card</button> : <div className={styles.quantity}><label>Qty<input aria-label={`Quantity for ${item?.name ?? "card"}`} type="number" min="1" max={item?.quantityVisible ? Math.max(1, Math.min(999, available)) : 999} value={line.quantity} onChange={(event) => { const quantity = Number(event.target.value); if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 999 && (!item?.quantityVisible || quantity <= available)) updateStoredCart(cartStoreSlug, (current) => setCartQuantity(current, line.publicId, quantity)); }} /></label><button type="button" onClick={() => updateStoredCart(cartStoreSlug, (current) => removeCartLine(current, line.publicId))} className={styles.textLink}>Remove</button></div>}
          </div>
        </article>;
      }) : <p className={styles.muted}>Your cart is empty. Add a card to save it here.</p>}</div>
      <div className={styles.cartFooter}><div className={styles.subtotal}><span>Current storefront subtotal</span><strong>{formatMoney(cartSubtotal)}</strong></div><p>This cart is saved on this browser and is for planning only. It does not reserve cards, submit a request, create an order, or collect payment. Checkout is coming later.</p><div className={styles.cartFooterActions}><button type="button" disabled={!cart.lines.length} onClick={() => updateStoredCart(cartStoreSlug, () => ({ version: 1, lines: [] }))} className={styles.secondary}>Clear cart</button><button type="button" onClick={() => setCartOpen(false)} className={styles.primary}>Continue browsing</button></div></div>
    </StorefrontDialog>, portalRoot) : null}
  </main>;
}

function FilterHiddenInputs({ query }: { query: StorefrontQuery }) {
  return Object.entries(query.filters).flatMap(([key, value]) => Array.isArray(value)
    ? value.map((entry) => <input key={`${key}-${entry}`} type="hidden" name={key} value={entry} />)
    : value ? <input key={key} type="hidden" name={key} value={value} /> : []);
}

function StorefrontFilters({ query, facets }: { query: StorefrontQuery; facets: ShowcaseFacets }) {
  return <form action="/shop" method="get" className={styles.filterForm}>
    {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
    <input type="hidden" name="sort" value={query.sort} />
    {FILTERS.map(([key, label]) => {
      const options = facets[key] ?? [];
      if (!options.length) return null;
      const active = query.filters[key] ?? [];
      return <fieldset key={key} className={styles.filterGroup}><legend>{label}</legend><div className={styles.filterOptions}>
        {options.slice(0, 30).map(({ value, count }) => <label key={value} className={styles.check}>
          <input type="checkbox" name={key} value={value} defaultChecked={active.some((selected) => selected.toLowerCase() === value.toLowerCase())} />
          <span className={styles.checkLabel}>{key === "set" ? value.toUpperCase() : value}</span><span className={styles.checkCount} aria-label={`${count.toLocaleString()} cards`}>{count.toLocaleString()}</span>
        </label>)}
      </div></fieldset>;
    })}
    <fieldset className={styles.filterGroup}><legend>Price range</legend><div className={styles.priceInputs}>
      <label>Minimum<span className={styles.priceField}><span aria-hidden="true">$</span><input aria-label="Minimum price" name="minPrice" type="number" min="0" step="0.01" placeholder="0.00" defaultValue={query.filters.minPrice} /></span></label>
      <label>Maximum<span className={styles.priceField}><span aria-hidden="true">$</span><input aria-label="Maximum price" name="maxPrice" type="number" min="0" step="0.01" placeholder="Any" defaultValue={query.filters.maxPrice} /></span></label>
    </div></fieldset>
    <label className={styles.check}><input type="checkbox" name="inStock" value="false" defaultChecked={query.filters.inStock === "false"} /><span>Include out of stock</span></label>
    <div className={styles.filterActions}><button className={styles.primary}>Apply filters</button><a href={query.q ? `/shop?q=${encodeURIComponent(query.q)}` : "/shop"} className={styles.textLink}>Reset filters</a></div>
  </form>;
}
