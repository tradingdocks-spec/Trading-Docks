import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { calculateStandings } from "../src/lib/tournament-standings.ts";

const migration = readFileSync("supabase/migrations/202609110002_tournament_standings.sql", "utf8");
const players = [
  { id: "a", displayName: "Alice", seedOrder: 1, playerStatus: "active" },
  { id: "b", displayName: "Bob", seedOrder: 2, playerStatus: "active" },
  { id: "c", displayName: "Cara", seedOrder: 3, playerStatus: "dropped" },
  { id: "d", displayName: "Drew", seedOrder: 4, playerStatus: "active" },
];

test("standings derive 3/1/0 match points and game W/L/D from reported history", () => {
  const standings = calculateStandings(players, [
    { playerOneId: "a", playerTwoId: "b", playerOneGamesWon: 2, playerTwoGamesWon: 0, gameDraws: 0, isBye: false, resultStatus: "reported" },
    { playerOneId: "c", playerTwoId: "d", playerOneGamesWon: 1, playerTwoGamesWon: 1, gameDraws: 1, isBye: false, resultStatus: "reported" },
  ]);
  const alice = standings.find((row) => row.playerId === "a")!;
  const cara = standings.find((row) => row.playerId === "c")!;
  assert.deepEqual([alice.matchPoints, alice.matchWins, alice.matchLosses, alice.matchDraws, alice.gameWins, alice.gameLosses], [3, 1, 0, 0, 2, 0]);
  assert.deepEqual([cara.matchPoints, cara.matchWins, cara.matchLosses, cara.matchDraws, cara.gameWins, cara.gameLosses, cara.gameDraws], [1, 0, 0, 1, 1, 1, 1]);
});

test("bye adds a win but does not create an opponent for OMW or OGW", () => {
  const [alice] = calculateStandings(players, [{ playerOneId: "a", playerTwoId: null, playerOneGamesWon: 0, playerTwoGamesWon: 0, gameDraws: 0, isBye: true, resultStatus: "reported" }]);
  assert.equal(alice.matchPoints, 3);
  assert.equal(alice.matchWins, 1);
  assert.equal(alice.omw, 0.33);
  assert.equal(alice.ogw, 0.33);
});

test("standings recompute after a result correction and retain dropped players", () => {
  const match = { playerOneId: "a", playerTwoId: "b", playerOneGamesWon: 2, playerTwoGamesWon: 0, gameDraws: 0, isBye: false, resultStatus: "corrected" } as const;
  const corrected = calculateStandings(players, [match]);
  assert.equal(corrected.find((row) => row.playerId === "a")!.matchPoints, 3);
  const draw = calculateStandings(players, [{ ...match, playerOneGamesWon: 1, playerTwoGamesWon: 1, gameDraws: 1 }]);
  assert.equal(draw.find((row) => row.playerId === "a")!.matchPoints, 1);
  assert.equal(draw.some((row) => row.playerId === "c" && row.playerStatus === "dropped"), true);
});

test("ranking is deterministic by points, OMW, GW, OGW, seed, then player id", () => {
  const standings = calculateStandings([
    { id: "z", displayName: "Zed", seedOrder: 2, playerStatus: "active" },
    { id: "a", displayName: "Amy", seedOrder: 1, playerStatus: "active" },
  ], []);
  assert.deepEqual(standings.map((row) => row.playerId), ["a", "z"]);
});

test("standings migration documents formulas, public privacy, and workspace access", () => {
  assert.match(migration, /win = 3 match points, draw = 1, loss = 0/);
  assert.match(migration, /completed matches/);
  assert.match(migration, /public_registration_enabled = true/);
  assert.match(migration, /public\.is_workspace_member/);
  assert.match(migration, /revoke all on function public\.get_tournament_standings/);
});

test("public event status exposes only safe pairing and standings fields", () => {
  const source = readFileSync("src/components/tournaments/PublicTournamentStatus.tsx", "utf8");
  assert.doesNotMatch(source, /email|phone|discord_username|notes|workspace_id/);
  assert.match(source, /currentRound/);
  assert.match(source, /opponent/);
});
