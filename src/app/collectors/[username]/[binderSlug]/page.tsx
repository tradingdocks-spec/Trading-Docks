import { notFound } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight, MessageCircle, Share2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

type DataRow = { data: Record<string, unknown> };

export default async function PublicBinderPage({ params, searchParams }: { params: Promise<{ username: string; binderSlug: string }>; searchParams: Promise<{ page?: string }> }) {
  const [{ username, binderSlug }, query] = await Promise.all([params, searchParams]);
  const admin = createAdminClient();
  const { data: profile } = await admin.from("collector_profiles").select("*").eq("username", username).eq("is_public", true).maybeSingle();
  if (!profile) notFound();
  const { data: binder } = await admin.from("portfolio_binders").select("*").eq("user_id", profile.user_id).eq("slug", binderSlug).eq("visibility", "public").maybeSingle();
  if (!binder) notFound();

  const [{ data: locationRow }, { data: itemRows }] = await Promise.all([
    admin.from("inventory_locations").select("data").eq("user_id", profile.user_id).eq("id", binder.location_id).maybeSingle(),
    admin.from("inventory_items").select("data").eq("user_id", profile.user_id).eq("location_id", binder.location_id),
  ]);
  const location = (locationRow?.data ?? {}) as Record<string, unknown>;
  const cards = ((itemRows ?? []) as DataRow[]).map((row) => row.data);
  const pageCount = typeof location.binderPages === "number" ? location.binderPages : 20;
  const currentPage = Math.min(pageCount, Math.max(1, Number(query.page ?? 1)));
  const leftPage = currentPage % 2 === 0 ? currentPage : currentPage;
  const rightPage = Math.min(pageCount, leftPage + 1);

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(139,92,246,.14),transparent_34%),var(--td-surface-default)] px-3 py-5 text-td-primary sm:px-6"><div className="mx-auto max-w-[1560px]"><header className="flex flex-col gap-4 rounded-[24px] border border-td-ink/[0.08] bg-td-surface/90 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.17em] text-td-accent-text">@{profile.username} · Collector Portfolio</p><h1 className="mt-2 text-2xl font-semibold text-td-primary">{binder.title}</h1><p className="mt-1 text-[11px] text-td-muted">{binder.description}</p></div><div className="flex gap-2"><button className="inline-flex h-10 items-center gap-2 rounded-xl border border-td-ink/[0.08] px-3 text-[11px] font-semibold text-td-primary"><Share2 className="h-4 w-4" /> Share</button>{binder.is_trade_binder ? <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-td-success px-3 text-[11px] font-bold text-td-on-accent"><MessageCircle className="h-4 w-4" /> Interested list</button> : null}</div></header><section className="mt-5 rounded-[30px] border border-td-violet/[0.14] bg-[linear-gradient(145deg,var(--td-surface-default),var(--td-surface-default)_50%,var(--td-surface-default))] p-4 shadow-[0_34px_110px_rgb(var(--td-shadow-rgb)/calc(.48*var(--td-shadow-strength)))] sm:p-7"><div className="grid gap-4 lg:grid-cols-2"><BinderPage title={`Page ${leftPage}`} cards={cards.filter((card) => card.binderPage === leftPage)} binder={binder} /><BinderPage title={`Page ${rightPage}`} cards={cards.filter((card) => card.binderPage === rightPage)} binder={binder} /></div><div className="mt-5 flex items-center justify-between"><a href={`?page=${Math.max(1,leftPage-2)}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-td-ink/[0.08] px-3 text-[11px] font-semibold text-td-secondary"><ChevronLeft className="h-4 w-4" /> Previous spread</a><span className="text-[11px] text-td-muted">Pages {leftPage}–{rightPage} of {pageCount}</span><a href={`?page=${Math.min(pageCount,leftPage+2)}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-td-ink/[0.08] px-3 text-[11px] font-semibold text-td-secondary">Next spread <ChevronRight className="h-4 w-4" /></a></div></section></div></main>;
}

function BinderPage({ title, cards, binder }: { title: string; cards: Record<string, unknown>[]; binder: Record<string, unknown> }) {
  return <article className="rounded-[24px] border border-td-ink/[0.10] bg-[radial-gradient(circle_at_top,rgba(139,92,246,.10),transparent_38%),linear-gradient(145deg,var(--td-surface-default),var(--td-surface-default))] p-4 shadow-[inset_0_0_70px_rgb(var(--td-shadow-rgb)/calc(.28*var(--td-shadow-strength))),0_20px_55px_rgb(var(--td-shadow-rgb)/calc(.30*var(--td-shadow-strength)))]"><div className="mb-4 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[0.15em] text-td-violet">{title}</span><BookOpen className="h-4 w-4 text-td-muted" /></div><div className="grid grid-cols-3 gap-3">{Array.from({ length: 9 }, (_, index) => { const card = cards.sort((a,b) => String(a.binderSlot ?? "").localeCompare(String(b.binderSlot ?? "")))[index]; return <div key={String(card?.id ?? index)} className="group relative aspect-[.716] overflow-hidden rounded-xl border border-td-ink/[0.08] bg-black/25 shadow-[0_12px_28px_rgb(var(--td-shadow-rgb)/calc(.34*var(--td-shadow-strength)))]">{typeof card?.imageUrl === "string" ? <img src={card.imageUrl} alt={String(card.name ?? "Card")} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : null}{card && binder.show_values && typeof card.value === "number" ? <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-1 text-[11px] font-semibold text-td-success">${card.value.toFixed(2)}</span> : null}</div>; })}</div></article>;
}
