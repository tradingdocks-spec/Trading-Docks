export type StandingsMatch = {
  playerOneId: string;
  playerTwoId: string | null;
  playerOneGamesWon: number;
  playerTwoGamesWon: number;
  gameDraws: number;
  isBye: boolean;
  resultStatus: string;
};

export type Standing = {
  playerId: string;
  seedOrder: number;
  displayName: string;
  playerStatus: string;
  matchPoints: number;
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  gameWins: number;
  gameLosses: number;
  gameDraws: number;
  omw: number;
  gw: number;
  ogw: number;
  rank: number;
};

export type StandingsRpcRow = {
  player_id: string;
  seed_order: number;
  display_name: string;
  player_status: string;
  match_points: number;
  match_wins: number;
  match_losses: number;
  match_draws: number;
  game_wins: number;
  game_losses: number;
  game_draws: number;
  omw: number | string;
  gw: number | string;
  ogw: number | string;
  rank: number | string;
};

export const standingFromRpc = (row: StandingsRpcRow): Standing => ({
  playerId: row.player_id,
  seedOrder: row.seed_order,
  displayName: row.display_name,
  playerStatus: row.player_status,
  matchPoints: row.match_points,
  matchWins: row.match_wins,
  matchLosses: row.match_losses,
  matchDraws: row.match_draws,
  gameWins: row.game_wins,
  gameLosses: row.game_losses,
  gameDraws: row.game_draws,
  omw: Number(row.omw),
  gw: Number(row.gw),
  ogw: Number(row.ogw),
  rank: Number(row.rank),
});

const MIN_PERCENT = 0.33;
const clampPercent = (value: number) => Math.max(MIN_PERCENT, Math.min(1, value || 0));

export function calculateStandings(players: Array<{ id: string; displayName: string; seedOrder: number; playerStatus: string }>, matches: StandingsMatch[]): Standing[] {
  const stats = new Map(players.map((player) => [player.id, { ...player, matchPoints: 0, matchWins: 0, matchLosses: 0, matchDraws: 0, gameWins: 0, gameLosses: 0, gameDraws: 0, opponents: [] as string[] }]));
  for (const match of matches.filter((item) => ["reported", "corrected"].includes(item.resultStatus))) {
    const one = stats.get(match.playerOneId); const two = match.playerTwoId ? stats.get(match.playerTwoId) : null;
    if (!one) continue;
    const p1 = match.isBye ? 3 : match.playerOneGamesWon === match.playerTwoGamesWon ? 1 : match.playerOneGamesWon > match.playerTwoGamesWon ? 3 : 0;
    const p2 = match.isBye ? 0 : 3 - p1;
    one.matchPoints += p1; one.matchWins += p1 === 3 ? 1 : 0; one.matchLosses += p1 === 0 ? 1 : 0; one.matchDraws += p1 === 1 ? 1 : 0;
    one.gameWins += match.playerOneGamesWon; one.gameLosses += match.playerTwoGamesWon; one.gameDraws += match.gameDraws;
    if (two) {
      two.matchPoints += p2; two.matchWins += p2 === 3 ? 1 : 0; two.matchLosses += p2 === 0 ? 1 : 0; two.matchDraws += p2 === 1 ? 1 : 0;
      two.gameWins += match.playerTwoGamesWon; two.gameLosses += match.playerOneGamesWon; two.gameDraws += match.gameDraws;
      one.opponents.push(two.id); two.opponents.push(one.id);
    }
  }
  const raw = new Map([...stats].map(([id, value]) => [id, { ...value, omw: 0, gw: clampPercent(value.gameWins / (value.gameWins + value.gameLosses + value.gameDraws)), ogw: 0 }]));
  for (const value of raw.values()) {
    const opponents = value.opponents.map((id) => raw.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
    value.omw = clampPercent(opponents.length ? opponents.reduce((sum, opponent) => sum + clampPercent(opponent.matchPoints / (3 * (opponent.matchWins + opponent.matchLosses + opponent.matchDraws))), 0) / opponents.length : MIN_PERCENT);
    value.ogw = clampPercent(opponents.length ? opponents.reduce((sum, opponent) => sum + opponent.gw, 0) / opponents.length : MIN_PERCENT);
  }
  return [...raw.values()].sort((a, b) => b.matchPoints - a.matchPoints || b.omw - a.omw || b.gw - a.gw || b.ogw - a.ogw || a.seedOrder - b.seedOrder || a.id.localeCompare(b.id)).map((value, index) => ({ playerId: value.id, seedOrder: value.seedOrder, displayName: value.displayName, playerStatus: value.playerStatus, matchPoints: value.matchPoints, matchWins: value.matchWins, matchLosses: value.matchLosses, matchDraws: value.matchDraws, gameWins: value.gameWins, gameLosses: value.gameLosses, gameDraws: value.gameDraws, omw: value.omw, gw: value.gw, ogw: value.ogw, rank: index + 1 }));
}

export const percentLabel = (value: number) => `${(value * 100).toFixed(1)}%`;
