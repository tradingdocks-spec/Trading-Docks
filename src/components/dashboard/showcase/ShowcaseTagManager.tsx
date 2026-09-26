"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Tag, Trash2 } from "lucide-react";

type TagRecord = { id: string; name: string; sort_order: number; created_at: string };
type InventoryRecord = { id: string; card_name: string; set_code: string | null; collector_number: string | null; quantity: number };
type Assignment = { inventory_item_id: string; tag_id: string };
type Listing = { inventory_item_id: string; enabled: boolean; storefront_listing_price: number | null; price_status: string };

export function ShowcaseTagManager() {
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [tagName, setTagName] = useState("");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const response = await fetch("/api/storefront/tags", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Tag data could not be loaded.");
      setTags(result.tags ?? []);
      setInventory(result.inventory ?? []);
      setAssignments(result.assignments ?? []);
      setListings(result.listings ?? []);
      setSelectedTag((current: string) => current || result.tags?.[0]?.id || "");
      setFeedback("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Tag data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    async function loadInitial() {
      try {
        const response = await fetch("/api/storefront/tags", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Tag data could not be loaded.");
        if (cancelled) return;
        setTags(result.tags ?? []);
        setInventory(result.inventory ?? []);
        setAssignments(result.assignments ?? []);
        setListings(result.listings ?? []);
        setSelectedTag((current: string) => current || result.tags?.[0]?.id || "");
      } catch (error) {
        if (!cancelled) setFeedback(error instanceof Error ? error.message : "Tag data could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadInitial();
    return () => { cancelled = true; };
  }, []);

  const visibleInventory = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return inventory;
    return inventory.filter((item) => [item.card_name, item.set_code, item.collector_number].some((value) => value?.toLowerCase().includes(term)));
  }, [inventory, search]);

  async function mutate(action: string, payload: Record<string, unknown>) {
    setSaving(true);
    setFeedback("");
    try {
      const response = await fetch("/api/storefront/tags", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Store tags could not be updated.");
      if (action === "create") {
        setTagName("");
        setSelectedTag(result.tag.id);
      }
      const message = action === "apply" ? "Tag applied to the selected inventory."
        : action === "remove" ? "Tag removed from the selected inventory."
          : action === "remove_tag" ? "Reusable tag removed."
            : action === "set_listing" ? "Public listing state updated." : "Reusable tag created.";
      setFeedback(message);
      await reload();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Store tags could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  function toggleItem(id: string) {
    setSelectedItems((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  return <main className="dashboard-responsive mx-auto max-w-6xl px-4 py-6 sm:px-7 sm:py-9">
    <div className="flex items-center gap-3 text-td-accent-text"><Tag className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[.18em]">Storefront tags</span></div>
    <div className="mt-3 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-semibold tracking-tight text-td-primary">Organize your public catalog</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-td-muted">Create reusable store tags and apply them to inventory. Card type, color, rarity, finish, condition, and other known facts remain derived from card and inventory metadata.</p></div><button onClick={() => void reload()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-td-ink/10 px-3 text-sm"><RefreshCw className="h-4 w-4" /> Refresh</button></div>
    <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.8fr)]">
      <div className="rounded-2xl border border-td-ink/10 bg-td-surface p-5"><h2 className="font-semibold text-td-primary">Reusable store tags</h2><form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); void mutate("create", { name: tagName }); }}><label className="sr-only" htmlFor="store-tag-name">New tag name</label><input id="store-tag-name" value={tagName} maxLength={48} onChange={(event) => setTagName(event.target.value)} placeholder="e.g. Staff Pick" className="min-h-11 min-w-0 flex-1 rounded-xl border border-td-ink/10 bg-td-ink/[.03] px-3 text-sm" /><button disabled={saving || !tagName.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-td-accent px-4 text-sm font-bold text-td-on-accent disabled:opacity-45"><Plus className="h-4 w-4" /> Create</button></form>
        <ul className="mt-4 divide-y divide-td-ink/[.08]">{tags.map((tag) => <li key={tag.id} className="flex items-center gap-3 py-3"><label className="flex min-h-10 flex-1 cursor-pointer items-center gap-3"><input type="radio" name="active-tag" checked={selectedTag === tag.id} onChange={() => setSelectedTag(tag.id)} className="h-4 w-4 accent-cyan-500" /><span className="font-medium text-td-primary">{tag.name}</span><span className="text-xs text-td-muted">{assignments.filter((assignment) => assignment.tag_id === tag.id).length} items</span></label><button aria-label={"Delete reusable tag " + tag.name} disabled={saving} onClick={() => { if (window.confirm("Remove the reusable tag “" + tag.name + "” and its assignments?")) void mutate("remove_tag", { tagId: tag.id }); }} className="min-h-10 rounded-lg px-3 text-rose-500 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button></li>)}</ul>
        {!tags.length && !loading ? <p className="mt-4 rounded-xl border border-dashed border-td-ink/15 p-5 text-center text-sm text-td-muted">Create your first reusable tag.</p> : null}
      </div>
      <div className="rounded-2xl border border-td-ink/10 bg-td-surface p-5"><h2 className="font-semibold text-td-primary">Publish items and apply tags</h2><p className="mt-1 text-xs text-td-muted">Only explicitly listed items with a positive storefront price and available quantity appear publicly. Select up to 500 rows per update. This never reserves or changes stock.</p><label className="mt-4 block text-sm font-medium text-td-secondary">Filter inventory<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, set, or collector number" className="mt-2 min-h-11 w-full rounded-xl border border-td-ink/10 bg-td-ink/[.03] px-3 text-sm" /></label>
        <div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-td-muted">{selectedItems.length} selected</span><button onClick={() => setSelectedItems(visibleInventory.map((item) => item.id))} className="min-h-9 px-2 text-xs font-semibold text-td-accent-text">Select shown</button></div>
        <div className="mt-2 max-h-[420px] divide-y divide-td-ink/[.08] overflow-y-auto rounded-xl border border-td-ink/[.08]">{visibleInventory.map((item) => { const listing = listings.find((entry) => entry.inventory_item_id === item.id); const listed = listing?.enabled; return <label key={item.id} className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-td-ink/[.025]"><input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => toggleItem(item.id)} className="h-4 w-4 accent-cyan-500" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-td-primary">{item.card_name}</span><span className="block truncate text-xs text-td-muted">{[item.set_code,item.collector_number].filter(Boolean).join(" · ")} · Qty {item.quantity} · {listed ? "Listed" : "Not listed"}</span></span><span className="text-xs text-td-muted">{listing?.price_status !== "READY" ? "Price required" : "$" + Number(listing.storefront_listing_price).toFixed(2)}</span></label>; })}</div>
        <div className="mt-3 flex flex-wrap gap-2"><button disabled={saving || !selectedItems.length} onClick={() => void mutate("set_listing", { enabled: true, itemIds: selectedItems })} className="min-h-10 rounded-xl bg-td-accent px-4 text-sm font-bold text-td-on-accent disabled:opacity-45">Publish selected</button><button disabled={saving || !selectedItems.length} onClick={() => void mutate("set_listing", { enabled: false, itemIds: selectedItems })} className="min-h-10 rounded-xl border border-td-ink/10 px-4 text-sm disabled:opacity-45">Unpublish</button><button disabled={saving || !selectedTag || !selectedItems.length} onClick={() => void mutate("apply", { tagId: selectedTag, itemIds: selectedItems })} className="min-h-10 rounded-xl border border-td-ink/10 px-4 text-sm disabled:opacity-45">Apply tag</button><button disabled={saving || !selectedTag || !selectedItems.length} onClick={() => void mutate("remove", { tagId: selectedTag, itemIds: selectedItems })} className="min-h-10 rounded-xl border border-td-ink/10 px-4 text-sm disabled:opacity-45">Remove tag</button><button onClick={() => setSelectedItems([])} className="min-h-10 rounded-xl px-3 text-sm text-td-muted">Clear selection</button></div>
      </div>
    </section>
    {feedback ? <p className="mt-4 rounded-xl border border-td-ink/10 p-3 text-sm text-td-secondary" role="status">{feedback}</p> : null}
    {loading ? <p className="mt-4 text-sm text-td-muted" role="status">Loading workspace tags…</p> : null}
  </main>;
}
