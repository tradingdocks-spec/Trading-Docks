import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BookOpen,
  CircleDollarSign,
  Layers3,
  LockKeyhole,
  Repeat2,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

import {
  buildAccountReturnPath,
  isValidShareToken,
  sanitizeLegacyBinderPayload,
  safeText,
  shareHasExpired,
} from "@/lib/public-share-security";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  referrer: "no-referrer",
};

export default async function SharedBinderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isValidShareToken(token)) notFound();

  const admin = createAdminClient();
  const { data } = await admin
    .from("binder_shares")
    .select(
      "id,title,mode,payload,created_at,expires_at,is_active,revoked_at,view_count,allow_interested_lists,require_account_for_actions",
    )
    .eq("token", token)
    .maybeSingle();

  if (
    !data ||
    data.is_active !== true ||
    data.revoked_at ||
    shareHasExpired(data.expires_at)
  ) {
    notFound();
  }

  const payload = sanitizeLegacyBinderPayload(data.payload);
  const cards = payload.cards;
  const isTrade = data.mode === "trade";
  const title = safeText(data.title, 120) || "Shared Binder";
  const sharePath = `/share/binder/${token}`;

  // Best-effort view count. No private data is returned to the visitor.
  await admin
    .from("binder_shares")
    .update({ view_count: Number(data.view_count ?? 0) + 1 })
    .eq("id", data.id)
    .eq("is_active", true);

  const signupUrl = buildAccountReturnPath(
    sharePath,
    isTrade ? "trade-binder" : "collection-showcase",
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,.16),transparent_32%),radial-gradient(circle_at_top_left,rgba(34,211,238,.10),transparent_32%),#020911] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-[1420px]">
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-300/[0.12] bg-emerald-300/[0.035] px-4 py-3">
          <span className="inline-flex items-center gap-2 text-[10px] font-semibold text-emerald-200">
            <ShieldCheck className="h-4 w-4" />
            Safe read-only share
          </span>
          <span className="hidden items-center gap-2 text-[9px] text-slate-600 sm:inline-flex">
            <LockKeyhole className="h-3.5 w-3.5" />
            No dashboard or inventory access
          </span>
        </div>

        <header className="overflow-hidden rounded-[30px] border border-violet-300/[0.16] bg-[linear-gradient(135deg,#0b1d2b,#071522_55%,#140b23)] p-6 shadow-[0_36px_130px_rgba(0,0,0,.46)] sm:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.16] bg-cyan-300/[0.055] px-3 py-2 text-[10px] font-semibold text-cyan-100">
                <BookOpen className="h-4 w-4" />
                Trading Docks Collector Vault
              </span>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">
                {title}
              </h1>
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-violet-200">
                {isTrade ? "Public trade binder" : "Collection showcase"}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat
                icon={Layers3}
                label="Cards"
                value={String(payload.totalCards || cards.length)}
              />
              <Stat
                icon={CircleDollarSign}
                label="Value"
                value={`$${payload.totalValue.toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}`}
              />
              <Stat
                icon={Repeat2}
                label="Pockets"
                value={String(payload.occupied || cards.length)}
              />
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {cards.map((card, index) => (
            <article
              key={`${card.name}-${card.page}-${card.slot}-${index}`}
              className="group overflow-hidden rounded-[22px] border border-white/[0.085] bg-[#07131d] p-2 shadow-[0_18px_48px_rgba(0,0,0,.30)] transition duration-300 hover:-translate-y-1 hover:border-violet-300/30"
            >
              <div className="relative aspect-[.716] overflow-hidden rounded-[16px] bg-black/25">
                {card.imageUrl ? (
                  <img
                    src={card.imageUrl}
                    alt={card.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-700">
                    <BookOpen className="h-9 w-9" />
                  </div>
                )}
                {card.page || card.slot ? (
                  <span className="absolute left-3 top-3 rounded-lg border border-white/[0.12] bg-black/75 px-2 py-1 text-[9px] font-bold text-cyan-200 backdrop-blur">
                    P{card.page ?? "-"} / {card.slot ?? "-"}
                  </span>
                ) : null}
              </div>
              <div className="p-3">
                <h2 className="truncate text-sm font-semibold text-slate-100">
                  {card.name}
                </h2>
                <p className="mt-1 truncate text-[10px] text-slate-600">
                  {[card.set, card.condition, card.finish]
                    .filter(Boolean)
                    .join(" / ") || "Collector card"}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-emerald-300">
                    {card.value === null ? "Value hidden" : `$${card.value.toFixed(2)}`}
                  </span>
                  <span className="text-[9px] text-slate-600">
                    Qty {card.quantity}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-8 overflow-hidden rounded-[26px] border border-cyan-300/[0.13] bg-[linear-gradient(135deg,rgba(34,211,238,.06),rgba(139,92,246,.07))] p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-300">
                {isTrade ? "Interested in these cards?" : "Like this collection?"}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {isTrade
                  ? "Create a free account to send an Interested List."
                  : "Build and share your own binder free."}
              </h2>
              <p className="mt-2 max-w-2xl text-[11px] leading-6 text-slate-500">
                Browsing this link does not provide access to the collector's
                dashboard, inventory, account, or other private binders.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={signupUrl}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-[10px] font-bold text-[#031319]"
              >
                <UserPlus className="h-4 w-4" />
                Create Free Account
              </Link>
              <Link
                href={`/sign-in?next=${encodeURIComponent(sharePath)}`}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.10] bg-black/15 px-4 text-[10px] font-semibold text-white"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>

        <footer className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-5 py-4 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Organized and shared with Trading Docks.</span>
          <span>
            {isTrade
              ? "An account is required before any trade interaction."
              : "This page is a read-only collection snapshot."}
          </span>
        </footer>
      </div>
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers3;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-[108px] rounded-2xl border border-white/[0.08] bg-black/20 p-3">
      <Icon className="h-4 w-4 text-cyan-300" />
      <p className="mt-3 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-600">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
