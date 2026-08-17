import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BUILD_INTENTS,
  calculateBuildabilityScore,
  buildWorkingDeckRequirementsFromCollection,
  cardLegalityForFormat,
  classifyCardRoles,
  compareRequirementsToCollection,
  findOwnedCommanderCandidates,
  generateDeckArchitectIntelligence,
  getFormatProfile,
  getLocalArchetypes,
  isBasicLand,
  maximumCopiesForCard,
  recommendOwnedSubstitutions,
  validateDeckRequirements,
  analyzeDeckHealth,
  type CollectionGraphCard,
  type DeckRequirement,
} from "../src/lib/deck-architect/index.ts";
import { loadDeckArchitectCollectionSnapshot, loadDeckArchitectSavedDecks, loadDeckArchitectServerState } from "../src/lib/deck-architect/server.ts";

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
    oracleText: "Lightning Bolt deals 3 damage to any target.",
    colorIdentity: ["R"],
    manaCost: "{R}",
    manaValue: 1,
    marketPrice: 0.75,
  },
  {
    inventoryId: "inv-chain",
    name: "Chain Lightning",
    quantityOwned: 4,
    typeLine: "Sorcery",
    oracleText: "Chain Lightning deals 3 damage to any target.",
    colorIdentity: ["R"],
    manaCost: "{R}",
    manaValue: 1,
    marketPrice: 2.5,
  },
  {
    inventoryId: "inv-swift",
    name: "Monastery Swiftspear",
    quantityOwned: 4,
    typeLine: "Creature - Human Monk",
    oracleText: "Haste. Prowess.",
    colorIdentity: ["R"],
    manaCost: "{R}",
    manaValue: 1,
    marketPrice: 0.6,
  },
  {
    inventoryId: "inv-mountain",
    name: "Mountain",
    quantityOwned: 18,
    typeLine: "Basic Land - Mountain",
    colorIdentity: ["R"],
    marketPrice: 0.05,
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
  assert.match(route, /loadDeckArchitectServerState/);
  assert.match(route, /redirect\("\/sign-in\?next=\/dashboard\/deck-architect"\)/);
  assert.match(navigation, /href: "\/dashboard\/deck-architect", label: "Deck Architect"/);
  assert.match(workspace, /Build, improve, and discover decks using the cards you actually own/);
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
                data: {
                  typeLine: "Artifact",
                  image_uris: { normal: "https://img.example/arcane-signet.jpg" },
                  oracle_text: "Add one mana of any color in your commander's color identity.",
                  mana_cost: "{2}",
                  color_identity: [],
                  legalities: { commander: "legal" },
                },
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
  assert.equal(snapshot.cards[0].imageUri, "https://img.example/arcane-signet.jpg");
  assert.equal(snapshot.cards[0].oracleText, "Add one mana of any color in your commander's color identity.");
  assert.equal(snapshot.cards[0].manaCost, "{2}");
  assert.deepEqual(snapshot.cards[0].legalities, { commander: "legal" });
  assert.equal(snapshot.cards[1].marketPrice, 37.5);
  assert.equal(snapshot.totalOwnedQuantity, 5);
});

test("Deck Architect landing state is product-facing and avoids internal engine language", () => {
  assert.match(workspace, /Build a Deck/);
  assert.match(workspace, /Build From My Collection/);
  assert.match(workspace, /Improve a Deck/);
  assert.match(workspace, /What Can I Build/);
  assert.match(workspace, /Your Collection/);
  assert.match(workspace, /No commanders found yet/);
  assert.doesNotMatch(workspace, /Provider-ready|Engine architecture|collection graph|Quantity scanned for v1|Owned sample|Full snapshot loaded|foundation pool|Proposal Control/i);
});

test("Deck Architect does not show buildability or health scores before a working deck exists", () => {
  assert.match(workspace, /Choose or build a deck to see how much of it you already own/);
  assert.match(workspace, /Choose or build a deck to analyze its balance, consistency, and interaction/);
  assert.match(workspace, /Not calculated/);
});

test("Deck Architect supports active commander selection card states and mobile modes", () => {
  assert.match(workspace, /setSelectedCommanderId/);
  assert.match(workspace, /Buildability/);
  assert.match(workspace, /Deck Health/);
  assert.match(workspace, /Missing Cards/);
  assert.match(workspace, /Card Workspace/);
  assert.match(workspace, /Deck Intelligence/);
  assert.match(workspace, /type ViewMode = "deck" \| "cards" \| "intelligence"/);
  assert.match(workspace, /aria-pressed/);
  assert.match(workspace, /Lock/);
  assert.match(workspace, /Must Include/);
});

test("Deck Architect preserves review-first behavior without fake autonomous AI", () => {
  assert.match(workspace, /Recommendations stay reviewable/);
  assert.match(workspace, /Deck Architect never mutates a deck silently/);
  assert.match(workspace, /Apply after review unavailable/);
  assert.doesNotMatch(workspace, /ChatGPT|magic AI deck builder|Apply Changes automatically|silently applies/i);
});

test("card role classifier uses rules text and type line deterministically", () => {
  assert.deepEqual(classifyCardRoles({
    name: "Counterspell",
    typeLine: "Instant",
    oracleText: "Counter target spell.",
    manaCost: "{U}{U}",
  }).slice(0, 2), ["interaction", "countermagic"]);
  assert.ok(classifyCardRoles({
    name: "Cultivate",
    typeLine: "Sorcery",
    oracleText: "Search your library for up to two basic land cards.",
    manaCost: "{2}{G}",
  }).includes("ramp"));
  assert.ok(classifyCardRoles({
    name: "Forest",
    typeLine: "Basic Land - Forest",
  }).includes("land"));
});

test("legality validator rejects copy-limit color-identity and illegal-card failures", () => {
  const format = getFormatProfile("commander");
  const commander = collection[0];
  const requirements: DeckRequirement[] = [
    requirement("commander", "Muldrotha, the Gravetide", 1, 12, true),
    {
      ...requirement("bolt", "Lightning Bolt", 2, 1, false, ["interaction"], "Instant"),
      colorIdentity: ["R"],
      legalities: { commander: "legal" },
    },
    {
      ...requirement("ring", "Sol Ring", 2, 1, false, ["ramp"], "Artifact"),
      colorIdentity: [],
      legalities: { commander: "legal" },
    },
    {
      ...requirement("banned", "Banned Example", 1, 1, false, ["threat"], "Creature"),
      legalities: { commander: "banned" },
    },
  ];

  const result = validateDeckRequirements(requirements, format, { commander });

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "color-identity"));
  assert.ok(result.issues.some((issue) => issue.code === "copy-limit"));
  assert.ok(result.issues.some((issue) => issue.code === "illegal-card"));
  assert.equal(cardLegalityForFormat(requirements[3], "commander"), "banned");
});

test("local provider exposes Pauper archetypes without copied third-party decklists", () => {
  const archetypes = getLocalArchetypes("pauper");

  assert.ok(archetypes.length >= 3);
  assert.equal(archetypes.every((archetype) => archetype.sourceType === "trading-docks-authored"), true);
  assert.equal(getLocalArchetypes("modern").length, 0);
});

test("Deck Architect intelligence ranks build opportunities and owned substitutions", () => {
  const intelligence = generateDeckArchitectIntelligence({ collection, generatedAt: "2026-08-16T00:00:00.000Z" });

  assert.equal(intelligence.provider.id, "trading-docks-local-deck-knowledge");
  assert.ok(intelligence.supportedFormats.includes("pauper"));
  assert.ok(intelligence.opportunities.some((opportunity) => opportunity.formatId === "pauper"));
  assert.ok(intelligence.opportunities.every((opportunity) => opportunity.buildability.requiredCards > 0));
  assert.ok(intelligence.limitations.some((item) => /proposal persistence/i.test(item)));
});

test("owned substitutions preserve exact ownership and explain confidence", () => {
  const missingMatch = compareRequirementsToCollection(
    [requirement("lava", "Lava Spike", 4, 1.25, false, ["interaction", "removal"], "Sorcery")],
    collection,
    getFormatProfile("pauper"),
  )[0];
  const substitutions = recommendOwnedSubstitutions(missingMatch, collection, getFormatProfile("pauper"));

  assert.equal(substitutions[0].ownedCard.name, "Chain Lightning");
  assert.ok(substitutions[0].score > 0);
  assert.ok(substitutions[0].reasons.length > 0);
});

test("working deck assembly validates complete Commander shells before scoring", () => {
  const requirements = buildWorkingDeckRequirementsFromCollection(collection, "commander", collection[0], "use-collection");
  const validation = validateDeckRequirements(requirements, getFormatProfile("commander"), { commander: collection[0] });

  assert.equal(requirements[0].board, "commander");
  assert.ok(requirements.length > 0);
  assert.equal(validation.issues.some((issue) => issue.code === "color-identity"), false);
});

test("Deck Architect route passes server-generated intelligence to the workspace", () => {
  assert.match(route, /loadDeckArchitectServerState/);
  assert.match(route, /<DeckArchitectWorkspace snapshot=\{snapshot\} intelligence=\{intelligence\} savedDecks=\{savedDecks\}/);
  assert.match(workspace, /DiscoverWorkspace/);
  assert.match(workspace, /provider\.name/);
  assert.match(workspace, /proposeDeckRecommendations/);
  assert.match(workspace, /recent Deck Vault decks available/);
});

test("Deck Architect server state combines collection snapshot and deterministic intelligence", async () => {
  const supabase = {
    from(table: string) {
      if (table === "deck_vault_decks") {
        const deckBuilder = {
          select() { return deckBuilder; },
          eq() { return deckBuilder; },
          order() { return deckBuilder; },
          limit() {
            return {
              data: [
                {
                  deck_key: "deck-1",
                  name: "Test Deck",
                  format: "Pauper",
                  commander: null,
                  deck_data: { cards: [{ quantity: 4 }, { quantity: 56 }] },
                  updated_at: "2026-08-16T00:00:00.000Z",
                },
              ],
              error: null,
            };
          },
        };
        return deckBuilder;
      }
      assert.equal(table, "inventory_items");
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        gt() { return builder; },
        order() { return builder; },
        limit() {
          return {
            data: [
              {
                id: "inv-bolt",
                card_name: "Lightning Bolt",
                quantity: 4,
                inventory_value: 3,
                data: { typeLine: "Instant", oracleText: "Lightning Bolt deals 3 damage to any target.", mana_cost: "{R}", color_identity: ["R"] },
              },
              {
                id: "inv-mountain",
                card_name: "Mountain",
                quantity: 20,
                inventory_value: 1,
                data: { typeLine: "Basic Land - Mountain", color_identity: ["R"] },
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

  const state = await loadDeckArchitectServerState(supabase, { id: "user-1" });

  assert.equal(state.snapshot.totalOwnedQuantity, 24);
  assert.equal(state.intelligence.provider.id, "trading-docks-local-deck-knowledge");
  assert.equal(state.savedDecks[0].cardCount, 60);
});

test("Deck Architect saved deck read integration remains user scoped", async () => {
  const supabase = {
    from(table: string) {
      assert.equal(table, "deck_vault_decks");
      const builder = {
        select(selection: string) {
          assert.match(selection, /deck_key,name,format,commander,deck_data,updated_at/);
          return builder;
        },
        eq(column: string, value: string) {
          assert.equal(column, "user_id");
          assert.equal(value, "user-1");
          return builder;
        },
        order(column: string, options: { ascending: boolean }) {
          assert.equal(column, "updated_at");
          assert.equal(options.ascending, false);
          return builder;
        },
        limit(value: number) {
          assert.equal(value, 8);
          return {
            data: [
              {
                deck_key: "deck-a",
                name: "League Pauper",
                format: "Pauper",
                commander: null,
                deck_data: { cards: [{ quantity: 20 }, { quantity: 40 }] },
                updated_at: "2026-08-16T00:00:00.000Z",
              },
            ],
            error: null,
          };
        },
      };
      return builder;
    },
  };

  const decks = await loadDeckArchitectSavedDecks(supabase, { id: "user-1" });

  assert.equal(decks[0].id, "deck-a");
  assert.equal(decks[0].cardCount, 60);
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
