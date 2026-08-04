import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Layers3, Share2 } from "lucide-react";
import {
  buildAccountReturnPath,
  isValidShareToken,
  shareHasExpired,
} from "@/lib/public-share-security";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function PortfolioSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isValidShareToken(token)) notFound();
  const admin = createAdminClient();
  const { data: share } = await admin.from("portfolio_shares")
    .select("id,share_type,payload,expires_at,view_count,is_active,revoked_at,visibility")
    .eq("token", token)
    .maybeSingle();
  if (
    !share ||
    share.is_active !== true ||
    share.revoked_at ||
    share.visibility === "private" ||
    shareHasExpired(share.expires_at)
  ) notFound();
  await admin.from("portfolio_shares").update({ view_count: Number(share.view_count ?? 0) + 1 }).eq("id", share.id);

  const payload = share.payload as Record<string, unknown>;
  const profile = (payload.profile ?? {}) as Record<string, unknown>;
  const binder = (payload.binder ?? {}) as Record<string, unknown>;
  const binders = Array.isArray(payload.binders) ? payload.binders as Record<string, unknown>[] : [];
  const cards = Array.isArray(payload.cards) ? payload.cards as Record<string, unknown>[] : [];
  const scope = share.share_type as string;

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,.17),transparent_34%),radial-gradient(circle_at_top_left,rgba(34,211,238,.09),transparent_32%),#020911] px-4 py-7 text-white sm:px-8"><div className="mx-auto max-w-[1480px]"><header className="rounded-[30px] border border-violet-300/[0.16] bg-[linear-gradient(135deg,#0b1e2c,#071522_52%,#160d28)] p-7 shadow-[0_36px_130px_rgba(0,0,0,.48)]"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.16] bg-cyan-300/[0.05] px-3 py-2 text-[10px] font-semibold text-cyan-100"><Share2 className="h-4 w-4" /> Trading Docks Showcase</span><h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em]">{scope === "portfolio" ? String(profile.displayName ?? "Collector Portfolio") : String(binder.title ?? "Binder Showcase")}</h1><p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-violet-200">{scope === "spread" ? "Full binder spread" : scope === "binder" ? "Entire binder" : scope}</p></header>{scope === "portfolio" ? <section className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{binders.map((entry,index) => <div key={index} className="aspect-[.76] rounded-[24px] border border-white/[0.12] p-5 shadow-[0_24px_65px_rgba(0,0,0,.38)]" style={{ background: `radial-gradient(circle at 70% 10%,${String(entry.accentColor ?? "#67e8f9")}33,transparent 34%),linear-gradient(145deg,${String(entry.coverColor ?? "#172554")},#020617)` }}><div className="flex h-full flex-col justify-end"><p className="text-xl font-semibold">{String(entry.title ?? "Binder")}</p><p className="mt-2 text-[9px] uppercase tracking-[0.14em] text-white/45">{String(entry.cardCount ?? 0)} cards</p></div></div>)}</section> : <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{cards.map((card,index) => <article key={index} className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#06131d] p-2">{typeof card.imageUrl === "string" ? <img src={card.imageUrl} alt={String(card.name ?? "Card")} className="aspect-[.716] w-full rounded-[14px] object-cover" /> : <div className="flex aspect-[.716] items-center justify-center rounded-[14px] bg-white/[0.03]"><BookOpen className="h-8 w-8 text-slate-700" /></div>}<div className="p-3"><p className="truncate text-sm font-semibold">{String(card.name ?? "Card")}</p><p className="mt-1 text-[9px] text-slate-600">{[card.set,card.condition,card.finish].filter(Boolean).join(" · ")}</p></div></article>)}</section>}<section className="mt-8 rounded-[24px] border border-cyan-300/[0.13] bg-[linear-gradient(135deg,rgba(34,211,238,.06),rgba(139,92,246,.07))] p-6"><p className="text-[9px] font-bold uppercase tracking-[0.17em] text-cyan-300">Build your own collector portfolio</p><h2 className="mt-2 text-2xl font-semibold text-white">Create a free account to organize and share your collection.</h2><p className="mt-2 text-[10px] leading-5 text-slate-500">This public link is read-only and does not grant access to the owner’s dashboard, inventory, account, or other private content.</p><div className="mt-5 flex flex-wrap gap-2"><Link href={buildAccountReturnPath(`/share/portfolio/${token}`, "collector-portfolio")} className="inline-flex h-11 items-center rounded-xl bg-cyan-300 px-4 text-[10px] font-bold text-[#031319]">Create Free Account</Link><Link href={`/sign-in?next=${encodeURIComponent(`/share/portfolio/${token}`)}`} className="inline-flex h-11 items-center rounded-xl border border-white/[0.10] px-4 text-[10px] font-semibold text-white">Sign In</Link></div></section><footer className="mt-8 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4 text-[10px] text-slate-600"><span>Organized and shared with Trading Docks.</span><span className="inline-flex items-center gap-2"><Layers3 className="h-4 w-4" /> Read-only showcase</span></footer></div></main>;
}
