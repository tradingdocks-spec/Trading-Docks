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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,.16),transparent_32%),radial-gradient(circle_at_top_left,rgb(var(--td-accent-rgb)/.10),transparent_32%),var(--td-surface-default)] px-4 py-8 text-td-primary sm:px-8">
      <div className="mx-auto max-w-[1420px]">
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-td-success/[0.12] bg-td-success/[0.035] px-4 py-3">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-td-success">
            <ShieldCheck className="h-4 w-4" />
            Safe read-only share
          </span>
          <span className="hidden items-center gap-2 text-[11px] text-td-muted sm:inline-flex">
            <LockKeyhole className="h-3.5 w-3.5" />
            No dashboard or inventory access
          </span>
        </div>

        <header className="overflow-hidden rounded-[30px] border border-td-violet/[0.16] bg-[linear-gradient(135deg,var(--td-surface-default),var(--td-surface-default)_55%,var(--td-surface-default))] p-6 shadow-[0_36px_130px_rgb(var(--td-shadow-rgb)/calc(.46*var(--td-shadow-strength)))] sm:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-td-accent/[0.16] bg-td-accent/[0.055] px-3 py-2 text-[11px] font-semibold text-td-accent-text">
                <BookOpen className="h-4 w-4" />
                Trading Docks Collector Vault
              </span>
              <h1 className="mt-5 text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">
                {title}
              </h1>
              <p className="mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-td-violet">
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
              className="group overflow-hidden rounded-[22px] border border-td-ink/[0.085] bg-td-surface p-2 shadow-[0_18px_48px_rgb(var(--td-shadow-rgb)/calc(.30*var(--td-shadow-strength)))] transition duration-300 hover:-translate-y-1 hover:border-td-violet/30"
            >
              <div className="relative aspect-[.716] overflow-hidden rounded-[16px] bg-black/25">
                {card.imageUrl ? (
                  <img
                    src={card.imageUrl}
                    alt={card.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-td-muted">
                    <BookOpen className="h-9 w-9" />
                  </div>
                )}
                {card.page || card.slot ? (
                  <span className="absolute left-3 top-3 rounded-lg border border-td-ink/[0.12] bg-black/75 px-2 py-1 text-[11px] font-bold text-td-accent-text backdrop-blur">
                    P{card.page ?? "-"} / {card.slot ?? "-"}
                  </span>
                ) : null}
              </div>
              <div className="p-3">
                <h2 className="truncate text-sm font-semibold text-td-primary">
                  {card.name}
                </h2>
                <p className="mt-1 truncate text-[11px] text-td-muted">
                  {[card.set, card.condition, card.finish]
                    .filter(Boolean)
                    .join(" / ") || "Collector card"}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-td-success">
                    {card.value === null ? "Value hidden" : `$${card.value.toFixed(2)}`}
                  </span>
                  <span className="text-[11px] text-td-muted">
                    Qty {card.quantity}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-8 overflow-hidden rounded-[26px] border border-td-accent/[0.13] bg-[linear-gradient(135deg,rgb(var(--td-accent-rgb)/.06),rgba(139,92,246,.07))] p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-td-accent-text">
                {isTrade ? "Interested in these cards?" : "Like this collection?"}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-td-primary">
                {isTrade
                  ? "Create a free account to send an Interested List."
                  : "Build and share your own binder free."}
              </h2>
              <p className="mt-2 max-w-2xl text-[11px] leading-6 text-td-muted">
                Browsing this link does not provide access to the collector's
                dashboard, inventory, account, or other private binders.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={signupUrl}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-td-accent px-4 text-[11px] font-bold text-td-on-accent"
              >
                <UserPlus className="h-4 w-4" />
                Create Free Account
              </Link>
              <Link
                href={`/sign-in?next=${encodeURIComponent(sharePath)}`}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-td-ink/[0.10] bg-black/15 px-4 text-[11px] font-semibold text-td-primary"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>

        <footer className="mt-6 flex flex-col gap-3 rounded-2xl border border-td-ink/[0.07] bg-td-ink/[0.025] px-5 py-4 text-[11px] text-td-muted sm:flex-row sm:items-center sm:justify-between">
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
    <div className="min-w-[108px] rounded-2xl border border-td-ink/[0.08] bg-black/20 p-3">
      <Icon className="h-4 w-4 text-td-accent-text" />
      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-td-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-td-primary">{value}</p>
    </div>
  );
}
