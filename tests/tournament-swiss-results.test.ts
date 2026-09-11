import assert from "node:assert/strict";
import { test } from "node:test";
import { pairSwissPlayers } from "../src/lib/tournament-pairing.ts";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202609100007_tournament_swiss_results.sql", "utf8");

test("Round 1 pairing is deterministic by seed and gives one bye to an odd field", () => {
  const players = Array.from({ length: 5 }, (_, index) => ({ id: `p${index + 1}`, seedOrder: index + 1, matchPoints: 0, opponents: [] }));
  assert.deepEqual(pairSwissPlayers(players, 1), [
    { playerOneId: "p5", playerTwoId: null, isBye: true },
    { playerOneId: "p1", playerTwoId: "p2", isBye: false },
    { playerOneId: "p3", playerTwoId: "p4", isBye: false },
  ]);
});

test("later Swiss rounds group by match points and avoid an available rematch", () => {
  const players = [
    { id: "p1", seedOrder: 1, matchPoints: 3, opponents: ["p2"] },
    { id: "p2", seedOrder: 2, matchPoints: 3, opponents: ["p1"] },
    { id: "p3", seedOrder: 3, matchPoints: 3, opponents: ["p4"] },
    { id: "p4", seedOrder: 4, matchPoints: 3, opponents: ["p3"] },
  ];
  const pairings = pairSwissPlayers(players, 2);
  assert.equal(pairings.every((pair) => !pair.isBye), true);
  assert.deepEqual(pairings.map((pair) => [pair.playerOneId, pair.playerTwoId]), [["p1", "p3"], ["p2", "p4"]]);
});

test("result and round RPCs use server-side authorization and optimistic concurrency", () => {
  assert.match(migration, /create or replace function public\.report_tournament_match/);
  assert.match(migration, /match_row\.version <> target_version/);
  assert.match(migration, /public\.can_manage_workspace\(tournament_workspace\)/);
  assert.match(migration, /create or replace function public\.complete_tournament_round/);
  assert.match(migration, /Every match must have a result/);
});

test("pairing generation is idempotent and records only one round pairing event", () => {
  assert.match(migration, /where tournament_id = target_tournament_id and round_number = next_round for update/);
  assert.match(migration, /return query select round_row\.id/);
  assert.match(migration, /'round-' \|\| next_round \|\| '-pairings'/);
  assert.match(migration, /on conflict \(tournament_id, dedupe_key\) do nothing/);
});

