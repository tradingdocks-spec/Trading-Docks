import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  applyDeckChangeProposal,
  createDeckChangeProposal,
  filterOwnedCards,
  inspectDeck,
  type DeckmasterBuildRequest,
} from "../src/lib/deckmaster/actions.ts";
import type { DeckCard, DeckRecord } from "../src/lib/deck-vault/types.ts";

const repoRoot = process.cwd();
const commander: DeckCard = { id: "krenko", name: "Krenko, Mob Boss", quantity: 1, manaValue: 4, colors: ["R"], typeLine: "Legendary Creature — Goblin Warrior", category: "Commander", price: 1, owned: true, ownedQuantity: 1, board: "commander", legalityStatus: "legal" };
const mountain: DeckCard = { id: "mountain", name: "Mountain", quantity: 98, manaValue: 0, colors: [], typeLine: "Basic Land — Mountain", category: "Lands", price: 0.05, owned: true, ownedQuantity: 98, board: "main", legalityStatus: "legal" };
const solRing: DeckCard = { id: "sol-ring", name: "Sol Ring", quantity: 1, manaValue: 1, colors: [], typeLine: "Artifact", category: "Artifacts", price: 1.5, owned: false, ownedQuantity: 0, board: "main", legalityStatus: "legal" };

function deck(cards = [commander, mountain]): DeckRecord {
  return { id: "deck-1", name: "Krenko", commander: commander.name, commanders: [commander.name], format: "EDH", theme: "Goblin tribal", colors: ["R"], marketValue: 0, ownedCount: 0, cardCount: 99, power: 7, updatedAt: "now", status: "Building", cards: cards.map((card) => ({ ...card })) };
}

test("Deck Architect is absent from visible navigation and its route redirects to Deck Vault", () => {
  const navigation = readFileSync(path.join(repoRoot, "src/components/dashboard/navigation.ts"), "utf8");
  const contract = readFileSync(path.join(repoRoot, "src/lib/navigation/contract.ts"), "utf8");
  const route = readFileSync(path.join(repoRoot, "src/app/dashboard/deck-architect/page.tsx"), "utf8");
  assert.doesNotMatch(navigation, /href: "\/dashboard\/deck-architect"/);
  assert.doesNotMatch(contract, /href: "\/dashboard\/deck-architect"/);
  assert.match(route, /redirect\("\/dashboard\/deck-vault"\)/);
});

test("Deckmaster receives existing and empty Deck Vault context", () => {
  assert.equal(inspectDeck(deck()).deckId, "deck-1");
  assert.equal(inspectDeck(deck()).commander, commander.name);
  assert.equal(inspectDeck(deck([])).isEmpty, true);
  const request: DeckmasterBuildRequest = { format: "EDH", commanderOrFocalCard: commander.name, archetype: "Goblin tribal", budget: 100, ownedCardPreference: "prefer", powerTarget: 7 };
  assert.equal(request.budget, 100);
});

test("proposal does not mutate until Apply; Apply updates the deck; Cancel is a no-op", () => {
  const original = deck();
  const proposal = createDeckChangeProposal(original, { additions: [{ card: solRing, quantity: 1 }], removals: [], swaps: [], explanation: "Complete the deck." });
  assert.equal(original.cards.some((card) => card.name === "Sol Ring"), false);
  assert.equal(proposal.legality.valid, true);
  assert.equal(proposal.legality.canApply, true);
  const applied = applyDeckChangeProposal(original, proposal);
  assert.equal(applied.cards.find((card) => card.name === "Sol Ring")?.quantity, 1);
  assert.equal(original.cards.length, 2, "cancelling by discarding the proposal leaves the source untouched");
});

test("Deckmaster rejects banned cards, Commander color identity violations, and singleton violations", () => {
  const banned = { ...solRing, id: "banned", name: "Banned Example", legalityStatus: "banned" as const };
  const offColor = { ...solRing, id: "blue", name: "Blue Example", colors: ["U" as const] };
  for (const card of [banned, offColor]) {
    const proposal = createDeckChangeProposal(deck(), { additions: [{ card, quantity: 1 }], removals: [], swaps: [], explanation: "Unsafe." });
    assert.equal(proposal.legality.valid, false);
    assert.equal(proposal.legality.canApply, false);
    assert.throws(() => applyDeckChangeProposal(deck(), proposal));
  }
  const complete = deck([commander, mountain, solRing]);
  const duplicate = createDeckChangeProposal(complete, { additions: [{ card: solRing, quantity: 1 }], removals: [], swaps: [], explanation: "Duplicate." });
  assert.ok(duplicate.legality.issues.some((issue) => issue.code === "copy-limit"));
  assert.equal(duplicate.legality.canApply, false);
  assert.throws(() => applyDeckChangeProposal(complete, duplicate));
});

test("owned-card-only filtering respects collection quantities", () => {
  assert.deepEqual(filterOwnedCards([solRing, mountain], [{ name: "Mountain", quantity: 2 }, { name: "Sol Ring", quantity: 0 }]).map((card) => card.name), ["Mountain"]);
});

test("Deckmaster shell is integrated with desktop and mobile access", () => {
  const editor = readFileSync(path.join(repoRoot, "src/components/dashboard/deck-vault/DeckDetailWorkspace.tsx"), "utf8");
  const panel = readFileSync(path.join(repoRoot, "src/components/dashboard/deck-vault/DeckmasterPanel.tsx"), "utf8");
  assert.match(editor, /<DeckmasterPanel/);
  assert.match(editor, /setDeckmasterMobileOpen\(true\)/);
  assert.match(panel, /Ask Deckmaster about this deck\.\.\./);
  assert.match(panel, /AI Deck Assistant/);
  assert.match(panel, /Review Changes/);
  assert.match(panel, /disabled=\{!proposal\.legality\.canApply\}/);
});
