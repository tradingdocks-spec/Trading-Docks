"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Save, SlidersHorizontal } from "lucide-react";
import { showcaseSlugError } from "@/lib/showcase-slug";

type Profile = Record<string, any>;

export function ShowcaseSettings({ profile }: { profile: Profile | null }) {
  const [form, setForm] = useState({ enabled: profile ? Boolean(profile.enabled) : true, slug: String(profile?.slug ?? "trading-docks"), displayName: String(profile?.display_name ?? "Trading Docks"), description: String(profile?.description ?? ""), allowRequests: profile?.allow_requests !== false, showPrices: profile?.show_prices !== false, showQuantities: profile?.show_quantities !== false, kioskEnabled: profile ? Boolean(profile.kiosk_enabled) : true, minimumPrice: profile?.minimum_price ? String(profile.minimum_price) : "" });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const slugError = showcaseSlugError(form.slug);
  const update = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    if (!form.displayName.trim()) { setFeedback("Display name is required."); return; }
    if (slugError) { setFeedback(slugError); return; }
    setSaving(true); setFeedback(null);
    try {
      const response = await fetch("/api/showcase/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, minimumPrice: form.minimumPrice ? Number(form.minimumPrice) : null }) });
      const result = await response.json();
      setFeedback(response.ok ? (profile ? "Showcase settings saved." : "Showcase created.") : result.error ?? "Settings could not be saved.");
    } catch { setFeedback("Settings could not be saved. Please try again."); }
    finally { setSaving(false); }
  }

  return <div className="dashboard-responsive mx-auto max-w-3xl px-4 py-6 sm:px-7 sm:py-9"><div className="flex items-center gap-3 text-td-accent-text"><SlidersHorizontal className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[.18em]">Showcase settings</span></div><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-td-primary">{profile ? "Control the customer view" : "Create your Showcase"}</h1><p className="mt-2 text-sm leading-6 text-td-muted">These controls affect only the public Showcase projection. Private inventory and internal operations remain protected.</p><section className="mt-7 space-y-5 rounded-[26px] border border-td-ink/[.08] bg-td-surface/60 p-6 sm:p-8"><Field label="Display name"><input required value={form.displayName} onChange={(event) => update("displayName", event.target.value)} placeholder="Trading Docks" /></Field><Field label="Public slug"><input required value={form.slug} onChange={(event) => update("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} aria-invalid={Boolean(slugError)} /><p className="mt-1 text-xs text-td-muted">tradingdocks.com/s/{form.slug || "your-store"}</p>{slugError ? <p className="mt-1 text-xs text-rose-200" role="alert">{slugError}</p> : null}</Field><Field label="Description"><textarea rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Browse our live singles inventory and request cards for pickup." /></Field><div className="grid gap-3 sm:grid-cols-2"><Toggle label="Enable Showcase" checked={form.enabled} onChange={(value) => update("enabled", value)} /><Toggle label="Show prices" checked={form.showPrices} onChange={(value) => update("showPrices", value)} /><Toggle label="Show quantities" checked={form.showQuantities} onChange={(value) => update("showQuantities", value)} /><Toggle label="Allow customer requests" checked={form.allowRequests} onChange={(value) => update("allowRequests", value)} /><Toggle label="Enable kiosk" checked={form.kioskEnabled} onChange={(value) => update("kioskEnabled", value)} /></div><Field label="Minimum public price (optional)"><input type="number" min="0" step="0.01" value={form.minimumPrice} onChange={(event) => update("minimumPrice", event.target.value)} placeholder="No minimum" /></Field><div className="flex flex-wrap items-center gap-3 pt-2"><button type="button" disabled={saving} onClick={() => void save()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-td-accent px-4 text-sm font-bold text-td-on-accent disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? "Saving…" : profile ? "Save changes" : "Create Showcase"}</button>{feedback ? <span className="text-sm text-td-muted" role="status">{feedback}</span> : null}</div></section></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-sm font-semibold text-td-primary">{label}<span className="mt-2 block">{children}</span></label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-td-ink/[.07] bg-td-ink/[.025] p-3 text-sm font-medium text-td-secondary"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-cyan-300" /></label>; }
