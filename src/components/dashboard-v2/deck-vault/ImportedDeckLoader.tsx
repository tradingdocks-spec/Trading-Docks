"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, TriangleAlert } from "lucide-react";

import type { DeckRecord } from "@/lib/deck-vault/types";
import { DeckDetailWorkspace } from "./DeckDetailWorkspace";

export function ImportedDeckLoader({
  deckId,
  fallback,
}: {
  deckId: string;
  fallback?: DeckRecord;
}) {
  const [deck, setDeck] = useState<DeckRecord | null>(fallback ?? null);
  const [ready, setReady] = useState(Boolean(fallback));

  useEffect(() => {
    if (fallback) return;
    try {
      const raw = localStorage.getItem(`trading-docks-deck:${deckId}`);
      setDeck(raw ? (JSON.parse(raw) as DeckRecord) : null);
    } catch {
      setDeck(null);
    } finally {
      setReady(true);
    }
  }, [deckId, fallback]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-td-canvas text-td-primary">
        <div className="text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-td-accent-text" />
          <p className="mt-4 text-[14px] text-td-secondary">Opening imported deck…</p>
        </div>
      </main>
    );
  }

  if (!deck) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-td-canvas px-5 text-td-primary">
        <section className="max-w-lg rounded-[26px] border border-td-warning/[0.13] bg-td-surface p-7 text-center">
          <TriangleAlert className="mx-auto h-8 w-8 text-td-warning" />
          <h1 className="mt-4 text-2xl font-semibold">Imported deck not found</h1>
          <p className="mt-3 text-[14px] leading-6 text-td-secondary">
            This temporary imported deck is stored in this browser. Import it again if browser storage was cleared or the link was opened on another device.
          </p>
          <Link href="/dashboard/deck-vault/import" className="mt-5 inline-flex h-11 items-center rounded-xl bg-td-accent px-5 text-[13px] font-semibold text-td-on-accent">
            Return to Import Center
          </Link>
        </section>
      </main>
    );
  }

  return <DeckDetailWorkspace deck={deck} />;
}
