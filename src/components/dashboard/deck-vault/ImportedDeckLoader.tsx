"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, TriangleAlert } from "lucide-react";

import type { DeckRecord } from "@/lib/deck-vault/types";
import { DeckDetailWorkspace } from "./DeckDetailWorkspace";
import { loadDeckRecord } from "@/lib/deck-vault/persistence";

export function ImportedDeckLoader({
  deckId,
  fallback,
}: {
  deckId: string;
  fallback?: DeckRecord;
}) {
  const [deck, setDeck] = useState<DeckRecord | null>(fallback ?? null);
  const [ready, setReady] = useState(Boolean(fallback));
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (fallback) return;
    void (async () => {
    try {
      setDeck(await loadDeckRecord(deckId));
    } catch (error) {
      setDeck(null);
      setLoadError(
        error instanceof Error ? error.message : "The deck could not be loaded.",
      );
    } finally {
      setReady(true);
    }
    })();
  }, [deckId, fallback]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020912] text-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-cyan-300" />
          <p className="mt-4 text-[14px] text-slate-400">Opening imported deck…</p>
        </div>
      </main>
    );
  }

  if (!deck) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#020912] px-5 text-white">
        <section className="max-w-lg rounded-[26px] border border-amber-300/[0.13] bg-[#06131f] p-7 text-center">
          <TriangleAlert className="mx-auto h-8 w-8 text-amber-300" />
          <h1 className="mt-4 text-2xl font-semibold">Imported deck not found</h1>
          <p className="mt-3 text-[14px] leading-6 text-slate-400">
            {loadError ||
              "This deck was not found in your account. Confirm that you are signed into the account that imported it."}
          </p>
          <Link href="/dashboard/deck-vault/import" className="mt-5 inline-flex h-11 items-center rounded-xl bg-cyan-300 px-5 text-[13px] font-semibold text-[#00121c]">
            Return to Import Center
          </Link>
        </section>
      </main>
    );
  }

  return <DeckDetailWorkspace deck={deck} />;
}
