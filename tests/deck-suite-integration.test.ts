import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  analyzeDeckRecordAgainstCollection,
  createDeckRecordFromArchitectPlan,
  deckRecordToArchitectRequirements,
  detectDeckListSource,
  exportDeckArenaText,
  exportDeckCsv,
  exportDeckPlainText,
  parseDeckListText,
} from "../src/lib/deck-suite/domain.ts";
import { loadDeckArchitectActiveDeck } from "../src/lib/deck-architect/server.ts";
import type { CollectionGraphCard, DeckRequirement } from "../src/lib/deck-architect/index.ts";
import type { DeckRecord } from "../src/lib/deck-vault/types.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const architectSource = readFileSync(
  path.join(repoRoot, "src/components/dashboard/deck-architect/DeckArchitectWorkspace.tsx"),
  "utf8",
);
const builderSource = readFileSync(
  path.join(repoRoot, "src/components/dashboard/deck-vault/DeckDetailWorkspace.tsx"),
  "utf8",
);

const requirements: DeckRequirement[] = [
  {
    id: "commander-1",
    name: "Muldrotha, the Gravetide",
    requiredQuantity: 1,
    board: "commander",
    roles: ["synergy"],
    estimatedPrice: 12,
    imageUri: "https://img.example/muldrotha.jpg",
    typeLine: "Legendary Creature - Elemental Avatar",
    colorIdentity: ["B", "G", "U"],
    isCommander: true,
  },
  {
    id: "main-sol-ring",
    name: "Sol Ring",
    requiredQuantity: 1,
    board: "main",
    roles: ["ramp"],
    estimatedPrice: 1.5,
    typeLine: "Artifact",
    colorIdentity: [],
  },
  {
    id: "main-forest",
    name: "Forest",
    requiredQuantity: 36,
    board: "main",
    roles: ["land"],
    estimatedPrice: 0.05,
    typeLine: "Basic Land - Forest",
    colorIdentity: ["G"],
  },
  {
    id: "side-force",
    name: "Force of Negation",
    requiredQuantity: 2,
    board: "sideboard",
    roles: ["countermagic"],
    estimatedPrice: 38,
    typeLine: "Instant",
    colorIdentity: ["U"],
  },
];

const collection: CollectionGraphCard[] = [
  {
    inventoryId: "owned-muldrotha",
    name: "Muldrotha, the Gravetide",
    quantityOwned: 1,
    typeLine: "Legendary Creature - Elemental Avatar",
    colorIdentity: ["B", "G", "U"],
    marketPrice: 12,
  },
  {
    inventoryId: "owned-sol-ring",
    name: "Sol Ring",
    quantityOwned: 1,
    typeLine: "Artifact",
    colorIdentity: [],
    marketPrice: 1.5,
  },
  {
    inventoryId: "owned-forest",
    name: "Forest",
    quantityOwned: 20,
    typeLine: "Basic Land - Forest",
    colorIdentity: ["G"],
    marketPrice: 0.05,
  },
];

test("Architect to Builder handoff preserves canonical Deck Vault deck details", () => {
  const deck = createDeckRecordFromArchitectPlan({
    id: "suite-deck-1",
    name: "Muldrotha Recursion",
    formatId: "commander",
    requirements,
    ownership: requirements.map((requirement) => ({
      requirement,
      ownedQuantity: requirement.name === "Force of Negation" ? 0 : requirement.requiredQuantity,
      missingQuantity: requirement.name === "Force of Negation" ? requirement.requiredQuantity : 0,
    })),
    commander: collection[0],
    buildIntentId: "use-collection",
    lockedCardIds: ["commander-1"],
    mustIncludeCardIds: ["main-sol-ring"],
    strategyId: "graveyard-value",
  });

  assert.equal(deck.id, "suite-deck-1");
  assert.equal(deck.format, "EDH");
  assert.equal(deck.commander, "Muldrotha, the Gravetide");
  assert.equal(deck.cards.find((card) => card.name === "Force of Negation")?.board, "sideboard");
  assert.equal(deck.cards.find((card) => card.name === "Force of Negation")?.owned, false);
  assert.deepEqual(deck.architectMetadata?.lockedCardIds, ["commander-1"]);
  assert.deepEqual(deck.architectMetadata?.mustIncludeCardIds, ["main-sol-ring"]);
  assert.equal(deck.architectMetadata?.strategyId, "graveyard-value");
});

test("Builder to Architect analysis uses the canonical deck record", () => {
  const deck = createDeckRecordFromArchitectPlan({
    id: "suite-deck-2",
    name: "Muldrotha Analysis",
    formatId: "commander",
    requirements,
    ownership: [],
    commander: collection[0],
    buildIntentId: "budget",
  });

  const analysis = analyzeDeckRecordAgainstCollection(deck, collection);
  assert.equal(analysis.requirements.length, deck.cards.length);
  assert.equal(analysis.ownership.find((match) => match.requirement.name === "Forest")?.missingQuantity, 16);
  assert.ok(analysis.validation.issues.some((issue) => issue.code === "deck-size" || issue.code === "main-deck-size"));
  assert.ok(analysis.health);
});

test("import parser preserves commander, sideboard, set, and collector fields", () => {
  const parsed = parseDeckListText([
    "Commander",
    "1 Muldrotha, the Gravetide (DOM) 199",
    "Deck",
    "1x Sol Ring (CMM) 396",
    "Sideboard",
    "2 Force of Negation",
  ].join("\n"));

  assert.equal(parsed[0].board, "commander");
  assert.equal(parsed[0].setCode, "dom");
  assert.equal(parsed[1].collectorNumber, "396");
  assert.equal(parsed[2].board, "sideboard");
  assert.equal(detectDeckListSource("Quantity,Name\n1,Sol Ring", "export.csv"), "CSV");
});

test("exports preserve quantities and sections without leaking Architect metadata", () => {
  const deck = createDeckRecordFromArchitectPlan({
    id: "suite-deck-3",
    name: "Export Deck",
    formatId: "commander",
    requirements,
    ownership: [],
    commander: collection[0],
    buildIntentId: "use-collection",
    lockedCardIds: ["commander-1"],
  });

  const plain = exportDeckPlainText(deck);
  const csv = exportDeckCsv(deck);
  const arena = exportDeckArenaText({
    ...deck,
    cards: deck.cards.map((card) => ({ ...card, setCode: "cmm", collectorNumber: "1" })),
  });

  assert.match(plain, /Commander\n1 Muldrotha/);
  assert.match(plain, /Sideboard\n2 Force of Negation/);
  assert.match(csv, /section,quantity,name,set,collector_number/);
  assert.doesNotMatch(plain, /lockedCardIds|mustIncludeCardIds|architectMetadata/);
  assert.match(arena ?? "", /Sideboard 2 Force of Negation \(CMM\) 1/);
});

test("Deck Architect active deck loader remains scoped to the authenticated user", async () => {
  const rowDeck: DeckRecord = createDeckRecordFromArchitectPlan({
    id: "owned-deck",
    name: "Owned Deck",
    formatId: "commander",
    requirements,
    ownership: [],
    commander: collection[0],
    buildIntentId: "use-collection",
  });
  const calls: Array<{ column: string; value: unknown }> = [];
  const supabase = {
    from(table: string) {
      assert.equal(table, "deck_vault_decks");
      return {
        select() { return this; },
        eq(column: string, value: unknown) {
          calls.push({ column, value });
          return this;
        },
        maybeSingle() {
          return Promise.resolve({ data: { deck_key: "owned-deck", deck_data: rowDeck }, error: null });
        },
      };
    },
  };

  const loaded = await loadDeckArchitectActiveDeck(supabase, { id: "user-1" }, "owned-deck");
  assert.equal(loaded?.id, "owned-deck");
  assert.deepEqual(calls, [
    { column: "user_id", value: "user-1" },
    { column: "deck_key", value: "owned-deck" },
  ]);
});

test("Deck suite UI exposes real integration actions and omits fake share shortcuts", () => {
  assert.match(architectSource, /Open in Deck Builder/);
  assert.match(architectSource, /saveDeckRecord/);
  assert.match(architectSource, /Commander not owned/);
  assert.doesNotMatch(builderSource, /shouldShowDeckArchitectEntry/);
  assert.doesNotMatch(builderSource, /Open in Deck Architect/);
  assert.match(builderSource, /Copy list/);
  assert.match(builderSource, /CSV/);
});
