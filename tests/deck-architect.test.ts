import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BUILD_INTENTS,
  calculateBuildabilityScore,
  compareRequirementsToCollection,
  findOwnedCommanderCandidates,
  getFormatProfile,
  isBasicLand,
  maximumCopiesForCard,
  analyzeDeckHealth,
  type CollectionGraphCard,
  type DeckRequirement,
} from "../src/lib/deck-architect/index.ts";
import { loadDeckArchitectCollectionSnapshot } from "../src/lib/deck-architect/server.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = readFileSync(
  path.join(repoRoot, "src/components/dashboard/deck-architect/DeckArchitectWorkspace.tsx"),
  "utf8",
);
const route = readFileSync(
  path.join(repoRoot, "src/app/dashboard/deck-architect/page.tsx"),
  "utf8",
);
const navigation = readFileSync(
  path.join(repoRoot, "src/components/dashboard/navigation.ts"),
  "utf8",
);

const collection: CollectionGraphCard[] = [
  {
    inventoryId: "inv-commander",
    name: "Muldrotha, the Gravetide",
    quantityOwned: 1,
    typeLine: "Legendary Creature - Elemental Avatar",
    colorIdentity: ["B", "G", "U"],
    marketPrice: 12,
  },
  {
    inventoryId: "inv-sol-ring",
    name: "Sol Ring",
    quantityOwned: 4,
    typeLine: "Artifact",
    colorIdentity: [],
    marketPrice: 1.5,
  },
  {
    inventoryId: "inv-bolt",
    name: "Lightning Bolt",
    quantityOwned: 3,
    typeLine: "Instant",
    colorIdentity: ["R"],
    marketPrice: 0.75,
  },
  {
    inventoryId: "inv-forest",
    name: "Forest",
    quantityOwned: 30,
    typeLine: "Basic Land - Forest",
    colorIdentity: ["G"],
    marketPrice: 0.05,
  },
];

test("Deck Architect format profiles are format-aware and not Commander-only", () => {
  const commander = getFormatProfile("commander");
  const casual = getFormatProfile("casual60");
  const pauper = getFormatProfile("pauper");

  assert.equal(commander.exactDeckSize, 100);
  assert.equal(commander.singleton, true);
  assert.equal(commander.enforceColorIdentity, true);
  assert.equal(casual.minimumMainDeckSize, 60);
  assert.equal(casual.maximumCopies, 4);
  assert.equal(pauper.legalityProvider, "scryfall");
  assert.match(pauper.recommendationProfile.notes.join(" "), /common-printing eligibility/);
});

test("copy limits handle Commander singleton and basic land exceptions", () => {
  const commander = getFormatProfile("commander");
  const modern = getFormatProfile("modern");

  assert.equal(maximumCopiesForCard(commander, "Sol Ring"), 1);
  assert.equal(maximumCopiesForCard(modern, "Lightning Bolt"), 4);
  assert.equal(isBasicLand("Forest"), true);
  assert.equal(maximumCopiesForCard(commander, "Forest"), Number.POSITIVE_INFINITY);
});

test("ownership comparison tracks owned partial and missing quantities", () => {
  const requirements: DeckRequirement[] = [
    requirement("sol", "Sol Ring", 1),
    requirement("bolt", "Lightning Bolt", 4),
    requirement("study", "Rhystic Study", 1, 38),
  ];
  const matches = compareRequirementsToCollection(requirements, collection, getFormatProfile("modern"));

  assert.equal(matches[0].status, "owned");
  assert.equal(matches[1].status, "partial");
  assert.equal(matches[1].ownedQuantity, 3);
  assert.equal(matches[1].missingQuantity, 1);
  assert.equal(matches[2].status, "missing");
  assert.equal(matches[2].estimatedMissingValue, 38);
});

test("Buildability Score uses deterministic ownership cost and commander factors", () => {
  const requirements: DeckRequirement[] = [
    requirement("commander", "Muldrotha, the Gravetide", 1, 12, true),
    requirement("sol", "Sol Ring", 1),
    requirement("study", "Rhystic Study", 1, 38),
  ];
  const matches = compareRequirementsToCollection(requirements, collection, getFormatProfile("commander"));
  const score = calculateBuildabilityScore(matches);

  assert.equal(score.requiredCards, 3);
  assert.equal(score.ownedCards, 2);
  assert.equal(score.missingCards, 1);
  assert.equal(score.commanderOwned, true);
  assert.equal(score.estimatedCompletionCost, 38);
  assert.ok(score.score > 40 && score.score < 100);
});

test("missing commander reduces buildability and is explicit", () => {
  const requirements: DeckRequirement[] = [
    requirement("commander", "Atraxa, Praetors' Voice", 1, 25, true),
    requirement("sol", "Sol Ring", 1),
  ];
  const score = calculateBuildabilityScore(
    compareRequirementsToCollection(requirements, collection, getFormatProfile("commander")),
  );

  assert.equal(score.commanderOwned, false);
  assert.ok(score.score < 70);
});

test("Build Intent model supports no-purchase and budget weighting as structure", () => {
  assert.equal(BUILD_INTENTS["no-purchases"].allowMissingCards, false);
  assert.equal(BUILD_INTENTS["no-purchases"].ownershipWeight, 1);
  assert.ok(BUILD_INTENTS.budget.priceWeight > BUILD_INTENTS.budget.powerWeight);
  assert.equal(typeof BUILD_INTENTS.budget.budgetCents, "number");
});

test("owned commander browsing detects eligible legendary creatures from collection metadata", () => {
  const commanders = findOwnedCommanderCandidates(collection);

  assert.equal(commanders[0].name, "Muldrotha, the Gravetide");
  assert.equal(commanders.some((card) => card.name === "Sol Ring"), false);
});

test("Deck Health analyzer creates actionable deterministic categories", () => {
  const requirements: DeckRequirement[] = [
    requirement("forest", "Forest", 24, 0.05, false, ["land"], "Basic Land - Forest"),
    requirement("bolt", "Lightning Bolt", 4, 0.75, false, ["interaction", "removal"], "Instant"),
    requirement("draw", "Chart a Course", 4, 0.2, false, ["card-advantage"], "Sorcery"),
    requirement("threat", "Tolarian Terror", 4, 0.25, false, ["threat"], "Creature"),
  ];
  const health = analyzeDeckHealth(requirements, getFormatProfile("pauper"));

  assert.ok(health.overall > 0);
  assert.ok(health.categories.mana >= 90);
  assert.ok(Array.isArray(health.warnings));
  assert.ok(Array.isArray(health.strengths));
});

test("Deck Architect dashboard is routed under Decks and uses real collection snapshot", () => {
  assert.match(route, /loadDeckArchitectCollectionSnapshot/);
  assert.match(route, /redirect\("\/sign-in\?next=\/dashboard\/deck-architect"\)/);
  assert.match(navigation, /href: "\/dashboard\/deck-architect", label: "Deck Architect"/);
  assert.match(workspace, /Build smarter decks from the cards you already own/);
  assert.match(workspace, /snapshot\.commanderCandidates/);
  assert.match(workspace, /compareRequirementsToCollection/);
  assert.match(workspace, /calculateBuildabilityScore/);
});

test("Deck Architect collection snapshot derives unit price from total inventory value", async () => {
  const supabase = {
    from(table: string) {
      assert.equal(table, "inventory_items");
      const builder = {
        select() { return builder; },
        eq(column: string, value: string) {
          assert.equal(column, "user_id");
          assert.equal(value, "user-1");
          return builder;
        },
        gt() { return builder; },
        order() { return builder; },
        limit() {
          return {
            data: [
              {
                id: "inv-1",
                card_name: "Arcane Signet",
                set_code: "clb",
                collector_number: "305",
                quantity: 4,
                inventory_value: 12,
                data: { typeLine: "Artifact" },
              },
              {
                id: "inv-2",
                card_name: "Rhystic Study",
                quantity: 1,
                inventory_value: 40,
                data: { unitMarketValue: 37.5, typeLine: "Enchantment" },
              },
            ],
            error: null,
            count: 2,
          };
        },
      };
      return builder;
    },
  };

  const snapshot = await loadDeckArchitectCollectionSnapshot(supabase, { id: "user-1" });

  assert.equal(snapshot.cards[0].marketPrice, 3);
  assert.equal(snapshot.cards[1].marketPrice, 37.5);
  assert.equal(snapshot.totalOwnedQuantity, 5);
});

test("Deck Architect UI keeps AI as infrastructure and preserves proposal review", () => {
  assert.match(workspace, /Propose, review, apply/);
  assert.match(workspace, /Natural-language requests become structured intent/);
  assert.match(workspace, /Must Include and Locked cards/);
  assert.doesNotMatch(workspace, /ChatGPT|magic AI deck builder|Apply Changes automatically/i);
});

function requirement(
  id: string,
  name: string,
  requiredQuantity: number,
  estimatedPrice: number | null = null,
  isCommander = false,
  roles: DeckRequirement["roles"] = ["synergy"],
  typeLine = "Creature",
): DeckRequirement {
  return {
    id,
    name,
    requiredQuantity,
    board: isCommander ? "commander" : "main",
    roles,
    estimatedPrice,
    isCommander,
    typeLine,
  };
}
