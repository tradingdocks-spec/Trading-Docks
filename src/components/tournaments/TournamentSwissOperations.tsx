"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, UserMinus } from "lucide-react";

type Player = { id: string; display_name: string; player_status: string; seed_order: number | null };
type Round = { id: string; round_number: number; stage: string; status: string; started_at: string | null; ends_at: string | null; completed_at: string | null };
type Match = { id: string; round_id: string; match_number: number; player_one_id: string; player_two_id: string | null; is_bye: boolean; result_status: string; player_one_games_won: number; player_two_games_won: number; game_draws: number; player_one_match_points: number | null; player_two_match_points: number | null; version: number };

export function TournamentSwissOperations({ tournamentId, currentRound, players: initialPlayers, rounds: initialRounds, matches: initialMatches }: { tournamentId: string; currentRound: number; players: Player[]; rounds: Round[]; matches: Match[] }) {
  const [players, setPlayers] = useState(initialPlayers);
  const [rounds, setRounds] = useState(initialRounds);
  const [matches, setMatches] = useState(initialMatches);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const names = useMemo(() => new Map(players.map((player) => [player.id, player.display_name])), [players]);
  const activeRound = rounds.find((round) => round.round_number === currentRound && round.status !== "completed") ?? rounds.at(-1);
  const activeMatches = matches.filter((match) => match.round_id === activeRound?.id).sort((a, b) => a.match_number - b.match_number);
  const reported = activeMatches.filter((match) => match.is_bye || ["reported", "corrected"].includes(match.result_status)).length;

  async function reload() {
    const [roundResponse, playerResponse] = await Promise.all([
      fetch(`/api/dashboard/tournaments/${tournamentId}/rounds`),
      fetch(`/api/dashboard/tournaments/${tournamentId}/players`),
    ]);
    const roundData = await roundResponse.json().catch(() => ({}));
    if (roundResponse.ok) { setRounds(roundData.rounds ?? []); setMatches(roundData.matches ?? []); }
    if (playerResponse.ok) {
      const playerData = await playerResponse.json().catch(() => ({}));
      if (Array.isArray(playerData.players)) setPlayers(playerData.players);
    }
  }
  async function call(path: string, body: Record<string, unknown>, action: string) {
    setBusy(action); setFeedback("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Tournament operation failed.");
      await reload(); setFeedback(action === "pair" ? "Pairings generated." : action === "complete" ? "Round completed. The next round is ready to generate." : "Operation completed.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Tournament operation failed."); }
    finally { setBusy(null); }
  }
  if (!activeRound && currentRound < 1) return null;
  return <section className="mt-6 rounded-[24px] border border-td-ink/[.08] bg-td-surface/60 p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-td-accent-text">Swiss operations</p><h2 className="mt-2 text-xl font-semibold text-td-primary">Round {activeRound?.round_number ?? currentRound}</h2><p className="mt-1 text-sm text-td-muted">{reported} of {activeMatches.length} matches reported · pairings are server-generated and reproducible</p></div><div className="flex flex-wrap gap-2">{activeRound && (activeRound.status === "completed" || activeMatches.length === 0) ? <button type="button" onClick={() => void call(`/api/dashboard/tournaments/${tournamentId}/rounds`, { roundNumber: activeRound.status === "completed" ? null : activeRound.round_number }, "pair")} disabled={busy !== null} className="inline-flex h-10 items-center gap-2 rounded-xl bg-td-accent px-3 text-xs font-bold text-td-on-accent"><ChevronRight className="h-4 w-4" /> {activeRound.status === "completed" ? "Generate next round" : "Generate pairings"}</button> : null}{activeRound && activeMatches.length > 0 && activeRound.status === "active" ? <button type="button" onClick={() => void call(`/api/dashboard/tournaments/${tournamentId}/rounds/complete`, { roundId: activeRound.id }, "complete")} disabled={busy !== null || reported !== activeMatches.length} className="inline-flex h-10 items-center gap-2 rounded-xl border border-td-accent/30 px-3 text-xs font-bold text-td-accent-text disabled:cursor-not-allowed disabled:opacity-50"><Check className="h-4 w-4" /> Complete round</button> : null}</div></div>
    {feedback ? <div role="status" className="mt-4 rounded-xl border border-td-accent/20 bg-td-accent/[.06] p-3 text-sm text-td-secondary">{feedback}</div> : null}
    {activeMatches.length ? <div className="mt-5 space-y-3">{activeMatches.map((match) => <SwissMatch key={match.id} match={match} playerOne={names.get(match.player_one_id) ?? "Player"} playerTwo={match.player_two_id ? names.get(match.player_two_id) ?? "Player" : null} disabled={busy !== null} onSave={(body) => void call(`/api/dashboard/tournaments/${tournamentId}/matches/${match.id}`, { ...body, version: match.version }, "result")} />)}</div> : <p className="mt-6 rounded-xl border border-dashed border-td-ink/[.12] p-5 text-center text-sm text-td-muted">Round foundation exists. Generate deterministic pairings when the player field is ready.</p>}
    <div className="mt-6 border-t border-td-ink/[.08] pt-5"><h3 className="text-sm font-semibold text-td-primary">Operational players</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{players.map((player) => <div key={player.id} className="flex items-center justify-between rounded-xl border border-td-ink/[.08] px-3 py-2"><span className="text-sm text-td-secondary">#{player.seed_order ?? "—"} {player.display_name}{player.player_status === "dropped" ? " · dropped" : ""}</span>{player.player_status === "active" ? <button type="button" aria-label={`Drop ${player.display_name}`} onClick={() => void call(`/api/dashboard/tournaments/${tournamentId}/players/${player.id}`, {}, "drop")} disabled={busy !== null} className="rounded-lg p-2 text-rose-200 hover:bg-rose-300/[.08] disabled:opacity-50"><UserMinus className="h-4 w-4" /></button> : null}</div>)}</div></div>
  </section>;
}

function SwissMatch({ match, playerOne, playerTwo, disabled, onSave }: { match: Match; playerOne: string; playerTwo: string | null; disabled: boolean; onSave: (body: { playerOneGames: number; playerTwoGames: number; gameDraws: number }) => void }) {
  const [p1, setP1] = useState(String(match.player_one_games_won)); const [p2, setP2] = useState(String(match.player_two_games_won)); const [draws, setDraws] = useState(String(match.game_draws));
  return <div className="rounded-2xl border border-td-ink/[.08] bg-td-background/40 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="mr-2 rounded-full bg-td-ink/[.08] px-2 py-1 text-[11px] font-bold text-td-muted">Table {match.match_number}</span><span className="text-sm font-semibold text-td-primary">{playerOne}{playerTwo ? ` vs ${playerTwo}` : " · BYE"}</span></div>{match.is_bye ? <span className="text-xs font-bold text-emerald-300">Bye · +3</span> : <span className="text-xs text-td-muted">{match.result_status === "pending" ? "Pending" : "Reported"}</span>}</div>{!match.is_bye ? <div className="mt-4 flex flex-wrap items-end gap-2"><label className="text-xs text-td-muted">P1 games<input type="number" min="0" max="99" value={p1} onChange={(event) => setP1(event.target.value)} className="mt-1 h-9 w-20 rounded-lg border border-td-ink/[.1] bg-td-surface px-2 text-sm text-td-primary" /></label><label className="text-xs text-td-muted">P2 games<input type="number" min="0" max="99" value={p2} onChange={(event) => setP2(event.target.value)} className="mt-1 h-9 w-20 rounded-lg border border-td-ink/[.1] bg-td-surface px-2 text-sm text-td-primary" /></label><label className="text-xs text-td-muted">Draws<input type="number" min="0" max="99" value={draws} onChange={(event) => setDraws(event.target.value)} className="mt-1 h-9 w-20 rounded-lg border border-td-ink/[.1] bg-td-surface px-2 text-sm text-td-primary" /></label><button type="button" onClick={() => onSave({ playerOneGames: Number(p1), playerTwoGames: Number(p2), gameDraws: Number(draws) })} disabled={disabled} className="h-9 rounded-lg bg-td-accent px-3 text-xs font-bold text-td-on-accent disabled:opacity-50">{match.result_status === "pending" ? "Report result" : "Correct result"}</button></div> : null}</div>;
}
