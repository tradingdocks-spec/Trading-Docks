"use client";

import { TournamentStandingsPanel, type PublicPairing } from "@/components/tournaments/TournamentStandingsPanel";
import type { Standing } from "@/lib/tournament-standings";

export function PublicTournamentStatus({ standings, pairings, currentRound }: { standings: Standing[]; pairings: PublicPairing[]; currentRound: number }) {
  return <><TournamentStandingsPanel standings={standings} pairings={pairings} currentRound={currentRound} publicView /><section className="mx-auto mt-6 max-w-5xl rounded-[28px] border border-td-ink/[.08] bg-td-surface p-6 text-td-primary sm:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-td-accent-text">Current pairings</p><h2 className="mt-2 text-2xl font-semibold">Round {currentRound || "—"}</h2>{pairings.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{pairings.map((pairing) => <div key={`${pairing.round}-${pairing.table}`} className="rounded-xl border border-td-ink/[.08] px-4 py-3 text-sm"><span className="mr-2 text-xs font-bold text-td-muted">Table {pairing.table}</span>{pairing.player} vs {pairing.opponent}</div>)}</div> : <p className="mt-4 text-sm text-td-muted">Pairings will appear when the current round is generated.</p>}</section></>;
}
