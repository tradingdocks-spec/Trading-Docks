"use client";

import Link from "next/link";
import { Copy, ExternalLink, Globe2, Settings2, ShoppingBag, Sparkles, Tag } from "lucide-react";

export function ShowcaseDashboard({ profile, inventoryCount, listedCount }: {
  profile: Record<string, any> | null; inventoryCount: number; listedCount: number;
}) {
  const publicUrl = `/s/${profile?.slug ?? "your-store"}`;
  const live = Boolean(profile?.enabled);
  return <main className="dashboard-responsive mx-auto max-w-6xl px-4 py-6 sm:px-7 sm:py-9">
    <div className="flex flex-wrap items-start justify-between gap-5"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-td-accent-text"><Sparkles className="h-4 w-4" /> Storefront</div><h1 className="mt-3 text-3xl font-semibold text-td-primary">Your public catalog</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-td-muted">Publish selected in-stock items with owner-configured storefront prices. The cart is a non-reserving browsing aid.</p></div><div className="flex gap-2"><Link href={publicUrl} target="_blank" className="inline-flex h-11 items-center gap-2 rounded-xl border border-td-ink/10 px-4 text-sm font-semibold text-td-primary"><ExternalLink className="h-4 w-4" /> Preview</Link><Link href="/dashboard/showcase/settings" className="inline-flex h-11 items-center gap-2 rounded-xl bg-td-accent px-4 text-sm font-bold text-td-on-accent"><Settings2 className="h-4 w-4" /> Settings</Link></div></div>
    <section className="mt-7 grid gap-4 sm:grid-cols-3"><Metric icon={Globe2} label="Publication" value={live ? "Published" : "Unpublished"} /><Metric icon={ShoppingBag} label="Active inventory rows" value={inventoryCount.toLocaleString()} /><Metric icon={Tag} label="Explicit listings" value={listedCount.toLocaleString()} /></section>
    <section className="mt-6 rounded-2xl border border-td-ink/10 bg-td-surface p-5"><h2 className="font-semibold text-td-primary">Share your catalog</h2><p className="mt-2 text-sm text-td-muted">Only explicitly published items with a valid storefront price and available quantity are shown.</p><div className="mt-4 flex flex-wrap items-center gap-3"><code className="min-w-0 flex-1 rounded-lg bg-td-ink/[.04] p-3 text-sm">tradingdocks.com{publicUrl}</code><button type="button" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${publicUrl}`)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-td-ink/10 px-3 text-sm font-semibold"><Copy className="h-4 w-4" /> Copy link</button></div><Link href="/dashboard/showcase/tags" className="mt-4 inline-flex min-h-10 items-center rounded-xl border border-td-ink/10 px-4 text-sm font-semibold">Manage listings and tags</Link></section>
  </main>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Globe2; label: string; value: string }) {
  return <div className="rounded-2xl border border-td-ink/10 bg-td-surface p-5"><Icon className="h-4 w-4 text-td-accent-text" /><p className="mt-4 text-xs text-td-muted">{label}</p><p className="mt-1 text-2xl font-semibold text-td-primary">{value}</p></div>;
}
