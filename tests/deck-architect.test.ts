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
  classifyCardRoleSignals,
  compareRequirementsToCollection,
  findOwnedCommanderCandidates,
  generateDeckArchitectIntelligence,
  getFormatProfile,
  getLocalArchetypes,
  isBasicLand,
  maximumCopiesForCard,
  recommendOwnedSubstitutions,
  proposeDeckRecommendations,
  rankCommanderSearchResults,
  rankCommanderStrategiesForCollection,
  constructValidatedArchetypeDeck,
  constructValidatedCommanderDeck,
  commanderColorIdentityFits,
  commanderColorIdentityQuery,
  detectCardTaxonomy,
  getCommanderCatalogCandidates,
  applyDeckChangeProposal,
  generateDeckArchitectBrewAnalysis,
  parseBrewRequest,
  analyzeDeckPersonality,
  detectHiddenSynergies,
  validateDeckRequirements,
  analyzeDeckHealth,
  resolveDeckCardImageUri,
  classifyStrategyTags,
  compareCommanderCandidates,
  createCommanderDeckPlan,
  createCommanderMechanicalProfile,
  critiqueCommanderDeck,
  evaluateCandidate,
  finalHumanSanityReview,
  TRADING_DOCKS_COMMANDER_KNOWLEDGE_PROVIDER,
  TRADING_DOCKS_COMMANDER_STRATEGY_INTELLIGENCE_PROVIDER,
  buildCommanderPackageTargets,
  selectArchetypeProfile,
  TRADING_DOCKS_DECK_KNOWLEDGE_PROVIDER,
  CommanderSpellbookProvider,
  EDHREC_INTEGRATION_STATUS,
  TradingDocksCorpusMetaProvider,
  buildRecommendationEvidence,
  normalizeSpellbookPayload,
  passesProfessionalQualityFloor,
  cardMetadataIssues,
  ProfessionalEvidenceGate,
  getDeckArchitectBuildBlocker,
  resolveDeckArchitectCommanderSelection,
  validateDeckCriticOutput,
  type CollectionGraphCard,
  type CommanderGenerationResult,
  type DeckRequirement,
} from "../src/lib/deck-architect/index.ts";
import { loadDeckArchitectCollectionSnapshot, loadDeckArchitectSavedDecks, loadDeckArchitectServerState } from "../src/lib/deck-architect/server.ts";
import { scryfallResultToPotentialCommander } from "../src/lib/deck-suite/domain.ts";

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

test("Deck Architect Budget Mode UI exposes individual and total missing-card controls", () => {
  assert.match(workspace, /Budget Mode/);
  assert.match(workspace, /Max individual missing-card price/);
  assert.match(workspace, /Total missing-card budget/);
  assert.match(workspace, /maxMissingCardPriceCents/);
  assert.match(workspace, /maxTotalMissingCardBudgetCents/);
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
  assert.match(workspace, /Choose a format and commander, set the build intent/);
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
  assert.match(workspace, /Collection/);
  assert.match(workspace, /Choose a commander to start building/);
  assert.doesNotMatch(workspace, /Provider-ready|Engine architecture|collection graph|Quantity scanned for v1|Owned sample|Full snapshot loaded|foundation pool|Proposal Control/i);
});

test("Deck Architect does not show buildability or health scores before a working deck exists", () => {
  assert.match(workspace, /Choose or build a deck to see how much of it you already own/);
  assert.match(workspace, /Choose or build a deck to analyze its balance, consistency, and interaction/);
  assert.match(workspace, /Not calculated/);
});

test("Deck Architect supports active commander selection card states and mobile modes", () => {
  assert.match(workspace, /setSelectedCommanderId/);
  assert.match(workspace, /Strategy/);
  assert.match(workspace, /Architect for me/);
  assert.match(workspace, /Balanced/);
  assert.match(workspace, /Custom/);
  assert.match(workspace, /selectedStrategyId/);
  assert.match(workspace, /No-purchase build unavailable/);
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
  assert.match(workspace, /Brew With Deck Architect/);
  assert.match(workspace, /AI proposes \/ Trading Docks validates/);
  assert.match(workspace, /Hidden Synergy/);
  assert.match(workspace, /What If \/ Fork Deck/);
  assert.match(workspace, /Deck Personality/);
  assert.match(workspace, /Architect Deck/);
  assert.match(workspace, /Apply after review unavailable/);
  assert.doesNotMatch(workspace, /ChatGPT|magic AI deck builder|Apply Changes automatically|silently applies/i);
});

test("Deck Architect selected commander state does not conflict with no-commander empty state", () => {
  const preBuildState = workspace.slice(
    workspace.indexOf("function PreBuildState"),
    workspace.indexOf("function DeckPreviewState"),
  );
  const collectionSummary = workspace.slice(
    workspace.indexOf("function CollectionSummary"),
    workspace.indexOf("function DiscoverWorkspace"),
  );

  assert.match(workspace, /selectedCommander=\{selectedCommander\}/);
  assert.match(workspace, /hasSelectedCommander=\{Boolean\(selectedCommander\)\}/);
  assert.match(preBuildState, /hasSelectedCommander: boolean/);
  assert.match(preBuildState, /formatRequiresCommander &&\s*!hasSelectedCommander &&\s*!hasCommanders/);
  assert.doesNotMatch(collectionSummary, /No commanders found yet/);
});

test("Deck Architect potential commander selection propagates to preview and generation", () => {
  assert.match(workspace, /onSelectPotentialCommander=\{\(card\) =>/);
  assert.match(workspace, /setPotentialCommander\(card\)/);
  assert.match(workspace, /setSelectedStrategyId\("auto"\)/);
  assert.match(workspace, /commander: selectedCommander/);
  assert.match(workspace, /Not currently in your collection/);
  assert.match(workspace, /\$\{selectedCommander\?\.name \?\? "Commander"\} is ready/);
});

test("Deck Architect resolves a selected potential commander as the active build context", () => {
  const ownedCommander = collection[0];
  const krenko: CollectionGraphCard = {
    inventoryId: "potential-krenko-tin-street-kingpin",
    name: "Krenko, Tin Street Kingpin",
    quantityOwned: 0,
    typeLine: "Legendary Creature - Goblin",
    colorIdentity: ["R"],
    setCode: "war",
    collectorNumber: "137",
    marketPrice: 0.74,
  };

  const resolved = resolveDeckArchitectCommanderSelection({
    selectedCommanderId: krenko.inventoryId,
    ownedCommanders: [ownedCommander],
    potentialCommander: krenko,
  });

  assert.equal(resolved.commander?.name, "Krenko, Tin Street Kingpin");
  assert.equal(resolved.source, "potential");
  assert.equal(resolved.owned, false);

  assert.equal(getDeckArchitectBuildBlocker({
    hasCollection: true,
    formatRequiresCommander: true,
    selectedCommander: resolved.commander,
    selectedCommanderOwned: resolved.owned,
    strategySelectionComplete: true,
    intentId: "use-collection",
  }), null);

  assert.equal(getDeckArchitectBuildBlocker({
    hasCollection: true,
    formatRequiresCommander: true,
    selectedCommander: resolved.commander,
    selectedCommanderOwned: resolved.owned,
    strategySelectionComplete: true,
    intentId: "no-purchases",
  }), "unowned-commander-collection-only");
});

test("Deck Architect source keeps selected potential commander from contradictory empty state", () => {
  assert.match(workspace, /resolveDeckArchitectCommanderSelection/);
  assert.match(workspace, /commanderSelection\.source === "potential"/);
  assert.match(workspace, /selectedCommanderOwned=\{selectedCommanderOwned\}/);
  assert.match(workspace, /DeckPreviewState/);
  assert.match(workspace, /Commander workspace/);
});

test("Deck Architect split build goals into source power and budget controls", () => {
  assert.match(workspace, /Card source/);
  assert.match(workspace, /Collection only/);
  assert.match(workspace, /Collection \+ suggestions/);
  assert.match(workspace, /Power target/);
  assert.match(workspace, /Casual/);
  assert.match(workspace, /Optimized/);
  assert.match(workspace, /Competitive/);
  assert.match(workspace, /Budget/);
  assert.match(workspace, /Best available/);
});

test("Deck Architect preserves valid commander selection across compatible format changes", () => {
  assert.match(workspace, /const nextFormat = getFormatProfile\(value\)/);
  assert.match(workspace, /if \(!nextFormat\.commanderRequired\)/);
  assert.match(workspace, /else if \(selectedCommander\)/);
  assert.match(workspace, /setSelectedStrategyId\(\(current\) => current \?\? "auto"\)/);
});

test("Deck Architect potential commander search tolerates the Krinko typo", () => {
  assert.match(workspace, /replace\(\/\^krinko\\b\/i, "Krenko"\)/);
  assert.match(workspace, /rankCommanderSearchResults\(candidates, commanderQuery/);
});

test("Deck Architect workspace builds Commander decks through the authenticated server generator", () => {
  assert.match(workspace, /\/api\/deck-architect\/commander-build/);
  assert.match(workspace, /generationStatus/);
  assert.match(workspace, /Deck couldn't be generated/);
  assert.match(workspace, /Budget Mode/);
  assert.match(workspace, /maxMissingCardPriceCents/);
  assert.match(workspace, /maxTotalMissingCardBudgetCents/);
  assert.match(workspace, /Complete validated deck/);
  assert.match(workspace, /Draft shell/);
  assert.doesNotMatch(workspace, /constructValidatedCommanderDeck\(/);
});

test("Commander build API uses server-side collection authority and Scryfall global candidates", () => {
  const apiRoute = readFileSync(
    path.join(repoRoot, "src/app/api/deck-architect/commander-build/route.ts"),
    "utf8",
  );

  assert.match(apiRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(apiRoute, /loadDeckArchitectCollectionSnapshot\(supabase, user\)/);
  assert.match(apiRoute, /fetchCommanderGlobalCandidates/);
  assert.match(apiRoute, /candidateSource: "global-scryfall"/);
  assert.doesNotMatch(apiRoute, /payload\?\.collection/);
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

test("card role classifier covers production recommendation role vocabulary", () => {
  const roles = classifyCardRoles({
    name: "Prismari Command",
    typeLine: "Instant",
    oracleText: "Choose two - Prismari Command deals 2 damage to any target; target player draws two cards, then discards two cards; target player creates a Treasure token; destroy target artifact.",
    manaCost: "{1}{U}{R}",
  });

  assert.ok(roles.includes("burn"));
  assert.ok(roles.includes("card-draw"));
  assert.ok(roles.includes("discard"));
  assert.ok(roles.includes("artifact-interaction"));
  assert.ok(roles.includes("token-generation"));
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

test("commander strategy ranking changes based on the user's collection", () => {
  const muldrotha: CollectionGraphCard = {
    inventoryId: "potential-muldrotha",
    name: "Muldrotha, the Gravetide",
    quantityOwned: 0,
    typeLine: "Legendary Creature - Elemental Avatar",
    colorIdentity: ["B", "G", "U"],
    marketPrice: 12,
  };
  const recursionCollection: CollectionGraphCard[] = [
    muldrotha,
    { inventoryId: "satyr", name: "Satyr Wayfinder", quantityOwned: 4, typeLine: "Creature - Satyr", oracleText: "When Satyr Wayfinder enters, reveal the top four cards. Put a land into your hand and the rest into your graveyard.", colorIdentity: ["G"], marketPrice: 0.15 },
    { inventoryId: "witness", name: "Eternal Witness", quantityOwned: 1, typeLine: "Creature - Human Shaman", oracleText: "Return target card from your graveyard to your hand.", colorIdentity: ["G"], marketPrice: 2.5 },
    { inventoryId: "seal", name: "Seal of Primordium", quantityOwned: 1, typeLine: "Enchantment", oracleText: "Sacrifice Seal of Primordium: Destroy target artifact or enchantment.", colorIdentity: ["G"], marketPrice: 0.3 },
  ];
  const sacrificeCollection: CollectionGraphCard[] = [
    muldrotha,
    { inventoryId: "seer", name: "Viscera Seer", quantityOwned: 1, typeLine: "Creature - Vampire Wizard", oracleText: "Sacrifice a creature: Scry 1.", colorIdentity: ["B"], marketPrice: 0.5 },
    { inventoryId: "cutthroat", name: "Zulaport Cutthroat", quantityOwned: 1, typeLine: "Creature - Human Rogue Ally", oracleText: "Whenever a creature you control dies, each opponent loses 1 life and you gain 1 life.", colorIdentity: ["B"], marketPrice: 1 },
    { inventoryId: "elder", name: "Sakura-Tribe Elder", quantityOwned: 1, typeLine: "Creature - Snake Shaman", oracleText: "Sacrifice Sakura-Tribe Elder: Search your library for a basic land.", colorIdentity: ["G"], marketPrice: 0.2 },
  ];

  const recursionTop = rankCommanderStrategiesForCollection(muldrotha, recursionCollection)[0];
  const sacrificeTop = rankCommanderStrategiesForCollection(muldrotha, sacrificeCollection)[0];

  assert.equal(recursionTop.strategy.label, "Permanent Recursion");
  assert.equal(sacrificeTop.strategy.label, "Sacrifice Value");
  assert.ok(recursionTop.score !== sacrificeTop.score || recursionTop.strategy.id !== sacrificeTop.strategy.id);
});

test("Potential commanders can be ranked even when the commander is not owned", () => {
  const atraxa: CollectionGraphCard = {
    inventoryId: "potential-atraxa",
    name: "Atraxa, Praetors' Voice",
    quantityOwned: 0,
    typeLine: "Legendary Creature - Phyrexian Angel Horror",
    oracleText: "At the beginning of your end step, proliferate.",
    colorIdentity: ["G", "W", "U", "B"],
    marketPrice: 18,
  };
  const fits = rankCommanderStrategiesForCollection(atraxa, [
    { inventoryId: "scales", name: "Hardened Scales", quantityOwned: 1, typeLine: "Enchantment", oracleText: "If one or more +1/+1 counters would be put on a creature you control, that many plus one are put on it instead.", colorIdentity: ["G"], marketPrice: 4 },
    { inventoryId: "sage", name: "Evolution Sage", quantityOwned: 1, typeLine: "Creature - Elf Druid", oracleText: "Landfall - proliferate.", colorIdentity: ["G"], marketPrice: 1.5 },
  ]);

  assert.equal(fits[0].commander.quantityOwned, 0);
  assert.equal(fits[0].strategy.label, "+1/+1 Counters");
  assert.ok(fits[0].signals.some((signal) => /owned cards match/i.test(signal.detail)));
});

test("Pauper archetype construction returns a complete validated 60-card shell", () => {
  const archetype = getLocalArchetypes("pauper").find((entry) => entry.id === "pauper-red-deck-wins");
  assert.ok(archetype);
  const result = constructValidatedArchetypeDeck({ archetype, collection, intentId: "best-possible" });
  const mainCount = result.requirements
    .filter((requirement) => requirement.board === "main")
    .reduce((sum, requirement) => sum + requirement.requiredQuantity, 0);
  const sideboardCount = result.requirements
    .filter((requirement) => requirement.board === "sideboard")
    .reduce((sum, requirement) => sum + requirement.requiredQuantity, 0);

  assert.equal(mainCount, 60);
  assert.ok(sideboardCount <= 15);
  assert.equal(result.validation.valid, true);
});

test("Build Intent materially changes constructed archetype output", () => {
  const archetype = getLocalArchetypes("pauper").find((entry) => entry.id === "pauper-red-deck-wins");
  assert.ok(archetype);
  const bestPossible = constructValidatedArchetypeDeck({ archetype, collection, intentId: "best-possible" });
  const noPurchases = constructValidatedArchetypeDeck({ archetype, collection, intentId: "no-purchases" });

  assert.ok(bestPossible.requirements.length > noPurchases.requirements.length);
  assert.ok(noPurchases.failure);
});

test("Commander construction does not label incomplete Commander shells as complete", () => {
  const commander = collection[0];
  const deepCollection = [
    ...collection,
    ...Array.from({ length: 110 }, (_, index): CollectionGraphCard => ({
      inventoryId: `owned-green-${index}`,
      name: `Owned Simic Tool ${index}`,
      quantityOwned: 1,
      typeLine: index % 4 === 0 ? "Instant" : index % 4 === 1 ? "Creature - Elf" : index % 4 === 2 ? "Artifact" : "Enchantment",
      oracleText: index % 4 === 0 ? "Draw a card." : index % 4 === 1 ? "Add one mana." : index % 4 === 2 ? "Return target card from your graveyard." : "Create a token.",
      colorIdentity: index % 2 === 0 ? ["G"] : ["U"],
      marketPrice: 0.25,
      legalities: { commander: "legal" },
    })),
  ];
  const result = constructValidatedCommanderDeck({ commander, collection: deepCollection, intentId: "use-collection" });
  const commandMainCount = result.requirements
    .filter((requirement) => requirement.board === "commander" || requirement.board === "main")
    .reduce((sum, requirement) => sum + requirement.requiredQuantity, 0);

  assert.notEqual(result.generationStatus, "complete");
  assert.ok(commandMainCount < 100);
  assert.equal(result.validation.valid, false);
  assert.ok(result.strategyFit);
});

test("Potential commander search ranks exact names ahead of catalog false positives", () => {
  const candidates: CollectionGraphCard[] = [
    commanderCandidate("cabal-patriarch", "Cabal Patriarch"),
    commanderCandidate("patron-akki", "Patron of the Akki"),
    commanderCandidate("kardum", "Kardum, Patron of Flames", ["B", "R"]),
    commanderCandidate("atraxa", "Atraxa, Praetors' Voice", ["W", "U", "B", "G"]),
    {
      ...commanderCandidate("artifact", "Atraxa's Skitterfang"),
      typeLine: "Artifact Creature - Phyrexian Insect",
    },
  ];

  const atraxaResults = rankCommanderSearchResults(candidates, "atraxa", { limit: 8 });
  assert.equal(atraxaResults[0].card.name, "Atraxa, Praetors' Voice");
  assert.equal(atraxaResults.some((result) => result.card.name === "Atraxa's Skitterfang"), false);

  const kardumResults = rankCommanderSearchResults(candidates, "kardum", { limit: 8 });
  assert.equal(kardumResults[0].card.name, "Kardum, Patron of Flames");
  assert.equal(kardumResults.some((result) => result.card.name === "Cabal Patriarch"), false);
});

test("Best Possible Commander construction can include missing strategy cards without polluting No Purchases", () => {
  const commander = collection[0];
  const bestPossible = constructValidatedCommanderDeck({
    commander,
    collection: [commander, collection[1]],
    intentId: "strongest-possible",
  });
  const noPurchases = constructValidatedCommanderDeck({
    commander,
    collection: [commander, collection[1]],
    intentId: "no-purchases",
  });

  assert.ok(bestPossible.requirements.some((requirement) => requirement.name === "Eternal Witness"));
  assert.equal(noPurchases.requirements.some((requirement) => requirement.name === "Eternal Witness"), false);
  assert.ok(bestPossible.ownership.some((match) => match.requirement.name === "Eternal Witness" && match.missingQuantity > 0));
});

test("Atraxa Poison and +1/+1 Counters generate materially different Best Possible lists", () => {
  const commander = commanderCandidate("atraxa", "Atraxa, Praetors' Voice", ["W", "U", "B", "G"]);
  const counters = constructValidatedCommanderDeck({
    commander,
    collection: [commander],
    intentId: "strongest-possible",
    strategyId: "atraxa-counters",
  });
  const poison = constructValidatedCommanderDeck({
    commander,
    collection: [commander],
    intentId: "strongest-possible",
    strategyId: "atraxa-poison",
  });
  const counterNames = new Set(counters.requirements.map((requirement) => requirement.name));
  const poisonNames = new Set(poison.requirements.map((requirement) => requirement.name));

  assert.equal(counters.generationStatus, "draft_shell");
  assert.equal(poison.generationStatus, "draft_shell");
  assert.ok(counters.requirements.reduce((sum, requirement) => sum + requirement.requiredQuantity, 0) < 100);
  assert.ok(poison.requirements.reduce((sum, requirement) => sum + requirement.requiredQuantity, 0) < 100);
  assert.ok(counterNames.has("Hardened Scales"));
  assert.ok(poisonNames.has("Venerated Rotpriest"));
  assert.equal(poisonNames.has("Hardened Scales"), false);
  assert.equal(counterNames.has("Venerated Rotpriest"), false);
});

test("unrelated Commander benchmarks do not recycle the same non-generic nonland package", () => {
  const krenko = constructValidatedCommanderDeck({
    commander: {
      ...commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]),
      typeLine: "Legendary Creature - Goblin Warrior",
      oracleText: "Tap: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.",
    },
    collection: [],
    intentId: "strongest-possible",
    strategyId: "krenko-go-wide-goblins",
    globalCandidates: krenkoCandidatePool(),
    candidateSource: "global-fixture",
  });
  const atraxaPoison = constructValidatedCommanderDeck({
    commander: commanderCandidate("atraxa", "Atraxa, Praetors' Voice", ["W", "U", "B", "G"]),
    collection: [],
    intentId: "strongest-possible",
    strategyId: "atraxa-poison",
    globalCandidates: [],
  });
  const muldrotha = constructValidatedCommanderDeck({
    commander: {
      ...commanderCandidate("muldrotha", "Muldrotha, the Gravetide", ["B", "G", "U"]),
      typeLine: "Legendary Creature - Elemental Avatar",
      oracleText: "During each of your turns, you may play a permanent card of each permanent type from your graveyard.",
    },
    collection: [],
    intentId: "strongest-possible",
    strategyId: "muldrotha-permanent-recursion",
    globalCandidates: [],
  });
  const overlap = suspiciousOverlap([
    nonGenericNonlandNames(krenko),
    nonGenericNonlandNames(atraxaPoison),
    nonGenericNonlandNames(muldrotha),
  ]);

  assert.equal(krenko.generationStatus, "complete");
  assert.equal(krenko.requirements.reduce((sum, requirement) => sum + requirement.requiredQuantity, 0), 100);
  assert.ok(overlap.length <= 2, overlap.join(", "));
});

test("No Purchases with an unowned potential commander is surfaced as an incomplete draft shell", () => {
  const commander = commanderCandidate("atraxa", "Atraxa, Praetors' Voice", ["W", "U", "B", "G"]);
  const result = constructValidatedCommanderDeck({
    commander,
    collection: [],
    intentId: "no-purchases",
    strategyId: "atraxa-counters",
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.ownership.some((match) => match.missingQuantity > 0), true);
  assert.equal(result.requirements.some((requirement) => requirement.name === "Hardened Scales"), false);
});

test("Best Possible can build around an unowned potential commander without requiring collection filler", () => {
  const commander = commanderCandidate("atraxa", "Atraxa, Praetors' Voice", ["W", "U", "B", "G"]);
  const result = constructValidatedCommanderDeck({
    commander,
    collection: [],
    intentId: "strongest-possible",
    strategyId: "atraxa-poison",
  });

  assert.equal(result.generationStatus, "draft_shell");
  assert.ok(result.requirements.reduce((sum, requirement) => sum + requirement.requiredQuantity, 0) < 100);
  assert.ok(result.requirements.some((requirement) => requirement.name === "Venerated Rotpriest"));
  assert.ok(result.ownership.some((match) => match.missingQuantity > 0));
});

test("Krenko Best Possible returns an archetype-dense Goblin shell without low-confidence filler", () => {
  const commander = {
    ...commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]),
    typeLine: "Legendary Creature - Goblin Warrior",
    oracleText: "Tap: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.",
  };
  const result = constructValidatedCommanderDeck({
    commander,
    collection: [],
    intentId: "strongest-possible",
    strategyId: "krenko-go-wide-goblins",
    globalCandidates: krenkoCandidatePool(),
    candidateSource: "global-fixture",
  });
  const names = new Set(result.requirements.map((requirement) => requirement.name));
  const totalCards = result.requirements.reduce((sum, requirement) => sum + requirement.requiredQuantity, 0);

  assert.equal(result.generationStatus, "complete");
  assert.equal(totalCards, 100);
  assert.equal(result.validation.valid, true);
  assert.ok(result.buildability);
  assert.equal(result.archetypeProfile?.id, "krenko-goblin-swarm");
  assert.equal(result.qualityGates.archetypeDensityAcceptable, true);
  assert.equal(result.qualityGates.strategySynergyAcceptable, true);
  assert.equal(result.qualityGates.formatValid, true);
  assert.equal(result.qualityGates.manaBaseAcceptable, true);
  assert.equal(result.qualityGates.candidateConfidenceAcceptable, true);
  assert.equal(result.qualityGates.noRejectedCards, true);
  assert.equal(result.qualityGates.noFiller, true);
  assert.ok((result.diagnostics?.composition.core ?? 0) + (result.diagnostics?.composition.synergy ?? 0) >= 26);
  assert.equal(result.candidateSourcePolicy, "Strategy and catalog recommendations first; ownership is calculated afterward.");
  assert.equal(result.candidateSource, "global-fixture");
  assert.ok(names.has("Impact Tremors"));
  assert.ok(names.has("Skirk Prospector"));
  assert.ok(names.has("Goblin Warchief"));
  assert.ok(result.requirements.some((requirement) => requirement.name === "Mountain" && requirement.requiredQuantity >= 20));
  assert.equal([...names].some((name) => name.includes("Blue")), false);
  assert.ok(result.ownership.some((match) => match.missingQuantity > 0));
});

test("Krenko Tin Street Kingpin potential commander keeps mono-red identity separate from ownership", () => {
  const commander = {
    ...commanderCandidate("krenko-tin-street", "Krenko, Tin Street Kingpin", ["R"]),
    typeLine: "Legendary Creature - Goblin",
    oracleText: "Whenever Krenko, Tin Street Kingpin attacks, put a +1/+1 counter on it, then create a number of 1/1 red Goblin creature tokens equal to Krenko's power.",
  };
  const result = constructValidatedCommanderDeck({
    commander,
    collection: [],
    intentId: "strongest-possible",
    strategyId: "krenko-go-wide-goblins",
    globalCandidates: krenkoCandidatePool(),
    candidateSource: "global-fixture",
  });
  const names = new Set(result.requirements.map((requirement) => requirement.name));

  assert.equal(result.generationStatus, "draft_shell");
  assert.ok(result.requirements.reduce((sum, requirement) => sum + requirement.requiredQuantity, 0) < 100);
  assert.ok(names.has("Krenko, Tin Street Kingpin"));
  assert.equal(result.requirements.some((requirement) => requirement.colorIdentity.includes("U")), false);
  assert.equal(result.buildability, null);
  assert.ok(result.ownership.some((match) => match.missingQuantity > 0));
});

test("Krenko Budget build respects the configured budget and surfaces unknown pricing", () => {
  const commander = {
    ...commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]),
    typeLine: "Legendary Creature - Goblin Warrior",
    oracleText: "Tap: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.",
  };
  const result = constructValidatedCommanderDeck({
    commander,
    collection: [],
    intentId: "budget",
    strategyId: "krenko-go-wide-goblins",
    budgetCents: 2500,
    globalCandidates: [
      ...krenkoCandidatePool(),
      commanderCard("pricey-mono-red", "Pricey Mono-Red Staple", ["R"], "Creature - Goblin", "Create a token."),
    ].map((card) => card.name === "Pricey Mono-Red Staple" ? { ...card, marketPrice: 20 } : card),
    candidateSource: "global-fixture",
  });
  const names = new Set(result.requirements.map((requirement) => requirement.name));

  assert.equal(result.generationStatus, "draft_shell");
  assert.equal(result.validation.valid, true);
  assert.equal(names.has("Pricey Mono-Red Staple"), false);
  assert.ok(result.warnings.some((warning) => /strict budget compliance/i.test(warning)));
  assert.ok(result.pricingSummary.unavailablePriceCount > 0);
});

test("Budget mode applies price caps only to missing cards and keeps expensive owned cards eligible", () => {
  const commander = {
    ...commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]),
    typeLine: "Legendary Creature - Goblin Warrior",
    oracleText: "Tap: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.",
  };
  const priceyOwned = {
    ...commanderCard("owned-pricey", "Impact Tremors", ["R"], "Enchantment", "Whenever a creature enters the battlefield under your control, Impact Tremors deals 1 damage to each opponent."),
    quantityOwned: 1,
    marketPrice: 60,
  };
  const priceyMissing = {
    ...commanderCard("missing-pricey", "Pricey Missing Goblin", ["R"], "Creature - Goblin", "Create two 1/1 red Goblin creature tokens."),
    quantityOwned: 0,
    marketPrice: 60,
  };
  const result = constructValidatedCommanderDeck({
    commander,
    collection: [priceyOwned],
    intentId: "budget",
    strategyId: "krenko-go-wide-goblins",
    budget: {
      enabled: true,
      maxMissingCardPriceCents: 1000,
      maxTotalMissingCardBudgetCents: 10_000,
      strict: true,
    },
    globalCandidates: [priceyOwned, priceyMissing, ...krenkoCandidatePool()],
    candidateSource: "global-fixture",
  });
  const names = new Set(result.requirements.map((requirement) => requirement.name));

  assert.equal(names.has("Impact Tremors"), true);
  assert.equal(names.has("Pricey Missing Goblin"), false);
  assert.equal(
    result.ownership.find((match) => match.requirement.name === "Impact Tremors")?.status,
    "owned",
  );
});

test("Budget mode enforces separate total missing-card budget and never treats unknown price as free", () => {
  const commander = {
    ...commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]),
    typeLine: "Legendary Creature - Goblin Warrior",
    oracleText: "Tap: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.",
  };
  const result = constructValidatedCommanderDeck({
    commander,
    collection: [],
    intentId: "budget",
    strategyId: "krenko-go-wide-goblins",
    budget: {
      enabled: true,
      maxMissingCardPriceCents: 2_500,
      maxTotalMissingCardBudgetCents: 1,
      strict: true,
    },
    globalCandidates: [
      ...krenkoCandidatePool().map((card) => ({ ...card, marketPrice: card.marketPrice ?? 1 })),
      { ...commanderCard("unknown-price", "Unpriced Goblin Engine", ["R"], "Creature - Goblin", "Create a Goblin token. Draw a card."), quantityOwned: 0, marketPrice: null },
    ],
    candidateSource: "global-fixture",
  });

  assert.equal(result.generationStatus, "draft_shell");
  assert.equal(result.qualityGates.budgetSatisfied, false);
  assert.ok(result.pricingSummary.unavailablePriceCount === 0 || result.warnings.some((warning) => /price/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /total missing-card budget/i.test(warning)));
  assert.equal(result.requirements.some((requirement) => requirement.name === "Unpriced Goblin Engine"), false);
  assert.equal(result.requirements.some((requirement) => requirement.estimatedPrice === 0), false);
});

test("bad production screenshot ramp fixtures cannot satisfy high-confidence Ramp", () => {
  for (const badCard of [
    commanderCard("big-wheel", "Big Wheel", ["R"], "Artifact", "Whenever a creature crews Big Wheel, add a lore counter."),
    commanderCard("giants-boulder", "Giant's Boulder", ["R"], "Artifact", "Equipped creature gets +2/+0. It has reach as long as you control a Giant."),
    commanderCard("contract-hero", "Contract Hero", ["R"], "Creature - Human Mercenary", "When this creature enters, create a Treasure token if you committed a crime this turn."),
    commanderCard("gravestone-strider", "Gravestone Strider", ["R"], "Creature - Elemental", "When it enters, return target land card from your graveyard to your hand."),
    commanderCard("zombie-mob", "Fixture Graveyard Counter Mob", ["B"], "Creature - Zombie", "This creature enters with counters. Exile a card from a graveyard to put a +1/+1 counter on it."),
    commanderCard("scavenging-ghoul", "Fixture Scavenging Ghoul", ["B"], "Creature - Zombie", "At the beginning of your end step, if a creature card left a graveyard, put a counter on this."),
  ]) {
    const signals = classifyCardRoleSignals(badCard);
    assert.equal(signals.some((signal) => signal.role === "ramp" && signal.confidence === "high"), false, badCard.name);
    assert.equal(signals.some((signal) => signal.role === "ramp" && signal.confidenceScore >= 0.55), false, badCard.name);
  }
});

test("Krenko archetype generation rejects observed off-strategy production fixtures", () => {
  const commander = {
    ...commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]),
    typeLine: "Legendary Creature - Goblin Warrior",
    oracleText: "Tap: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.",
  };
  const rejectedFixtures = [
    commanderCard("heroes-for-hire", "Heroes for Hire", ["R"], "Sorcery", "Create a Treasure token for each Mercenary you control."),
    commanderCard("contract-hero", "Contract Hero", ["R"], "Creature - Human Mercenary", "When this creature enters, create a Treasure token if you committed a crime this turn."),
    commanderCard("giants-boulder", "Giant's Boulder", ["R"], "Artifact - Equipment", "Equipped creature gets +2/+0. It has reach as long as you control a Giant."),
    commanderCard("brass-secretary", "Brass Secretary", [], "Artifact Creature - Construct", "Whenever you cast your second spell each turn, draw a card."),
    commanderCard("well-of-discovery", "Well of Discovery", [], "Artifact", "At the beginning of your end step, if you committed a crime this turn, investigate."),
    commanderCard("big-wheel", "Big Wheel", [], "Artifact - Vehicle", "Whenever a creature crews Big Wheel, add a lore counter."),
    commanderCard("stone-giant", "Stone-Giant of High Pass", ["R"], "Creature - Giant", "Reach. Whenever a Giant attacks, target creature gets +2/+0."),
  ];
  const result = constructValidatedCommanderDeck({
    commander,
    collection: [],
    intentId: "strongest-possible",
    strategyId: "krenko-go-wide-goblins",
    globalCandidates: [...rejectedFixtures, ...krenkoCandidatePool()],
    candidateSource: "global-fixture",
  });
  const names = new Set(result.requirements.map((requirement) => requirement.name));

  assert.equal(result.generationStatus, "complete");
  assert.equal(result.requirements.reduce((sum, requirement) => sum + requirement.requiredQuantity, 0), 100);
  for (const fixture of rejectedFixtures) {
    assert.equal(names.has(fixture.name), false, fixture.name);
  }
  const rejectedTotal = Object.values(result.diagnostics?.rejectionCounts ?? {}).reduce((sum, count) => sum + count, 0);
  assert.ok(rejectedTotal >= rejectedFixtures.length);
});

test("Commander recommendation evidence rejects legal cards with insufficient deck-specific support", () => {
  const commander = {
    ...commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]),
    typeLine: "Legendary Creature - Goblin Warrior",
    oracleText: "Tap: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.",
  };
  const profile = TRADING_DOCKS_DECK_KNOWLEDGE_PROVIDER.getCommanderProfile(commander, null, []);
  const archetype = selectArchetypeProfile(profile, null);
  const filler = commanderCard("random-legal", "Random Red Vehicle", ["R"], "Artifact - Vehicle", "Whenever this Vehicle attacks, scry 1.");
  const evaluation = evaluateCandidate(filler, archetype);
  const evidence = buildRecommendationEvidence(filler, evaluation, {
    commander,
    archetype,
    strategy: null,
    intentId: "strongest-possible",
    ownedQuantity: 0,
    source: "inferred",
  });

  assert.equal(evidence.confidence, "insufficient");
  assert.equal(passesProfessionalQualityFloor(evidence, "strongest-possible"), false);
  assert.ok(evidence.rejectionReasons?.some((reason) => /archetype|confidence|strategy|role/i.test(reason)));
});

test("Krenko recommendations carry professional evidence and keep generic staples capped", () => {
  const commander = {
    ...commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]),
    typeLine: "Legendary Creature - Goblin Warrior",
    oracleText: "Tap: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.",
  };
  const result = constructValidatedCommanderDeck({
    commander,
    collection: [],
    intentId: "strongest-possible",
    strategyId: "krenko-go-wide-goblins",
    globalCandidates: [
      ...krenkoCandidatePool(),
      commanderCard("celestial-prism", "Celestial Prism", [], "Artifact", "Pay 2, tap: Add one mana of any color."),
      commanderCard("random-vehicle", "Random Red Vehicle", ["R"], "Artifact - Vehicle", "Whenever this Vehicle attacks, scry 1."),
    ],
    candidateSource: "global-fixture",
  });
  const nonland = result.requirements.filter((requirement) => requirement.board === "main" && !requirement.roles.includes("land"));
  const genericCount = nonland.filter((requirement) => requirement.archetypeCategory === "generic").length;
  const names = new Set(result.requirements.map((requirement) => requirement.name));

  assert.equal(result.generationStatus, "complete");
  assert.ok(genericCount <= (result.archetypeProfile?.genericCardLimit ?? 0));
  assert.equal(names.has("Celestial Prism"), false);
  assert.equal(names.has("Random Red Vehicle"), false);
  assert.ok(nonland.some((requirement) => requirement.recommendationEvidence?.confidence === "strong" || requirement.recommendationEvidence?.confidence === "good"));
});

test("Trading Docks Commander knowledge provider exposes EDHREC-class shells without EDHREC scraping", async () => {
  const shell = await TRADING_DOCKS_COMMANDER_KNOWLEDGE_PROVIDER.getAverageShell("Krenko, Mob Boss", "krenko-go-wide-goblins");
  const recommendations = await TRADING_DOCKS_COMMANDER_KNOWLEDGE_PROVIDER.getRecommendedCards("Krenko, Mob Boss", "krenko-go-wide-goblins");

  assert.ok(shell);
  assert.equal(shell.commanderId, "Krenko, Mob Boss");
  assert.equal(shell.strategyId, "krenko-go-wide-goblins");
  assert.ok(shell.coreCards.some((card) => card.name === "Skirk Prospector"));
  assert.ok(shell.coreCards.some((card) => card.name === "Goblin Warchief"));
  assert.ok(shell.strongSynergyCards.length >= 35);
  assert.ok(shell.landTarget.min >= 34);
  assert.ok(shell.landTarget.max <= 39);
  assert.ok(recommendations.length >= 40);
  assert.ok(recommendations.some((card) => card.name === "Impact Tremors" && card.commanderSynergyScore && card.commanderSynergyScore >= 0.8));
  assert.equal(EDHREC_INTEGRATION_STATUS.integrated, false);
  assert.equal(EDHREC_INTEGRATION_STATUS.scrapingAllowed, false);
});

test("incidental Treasure text does not make Goblin Airbrusher a primary mana-fixing card", () => {
  const card = commanderCard(
    "goblin-airbrusher",
    "Goblin Airbrusher",
    ["R"],
    "Creature - Goblin Artificer",
    "When Goblin Airbrusher enters the battlefield, if you committed a crime this turn, create a Treasure token.",
  );
  const roleSignals = classifyCardRoleSignals(card);
  const tags = classifyStrategyTags(card);

  assert.equal(roleSignals.some((signal) => signal.role === "mana-fixing" && signal.confidence === "high"), false);
  assert.equal(roleSignals.some((signal) => signal.role === "mana-fixing" && signal.confidenceScore >= 0.55), false);
  assert.equal(roleSignals.some((signal) => signal.role === "ramp" && signal.confidence === "high"), false);
  assert.ok(tags.includes("goblin"));
  assert.equal(tags.includes("mana-engine"), false);
});

test("live screenshot mana-fixing patterns do not satisfy fixing from incidental Treasure or unrelated artifacts", () => {
  const fixtures = [
    commanderCard("grey-dog", "Fixture Long-Bodied Hound", ["R"], "Creature - Dog", "Whenever this creature attacks, create a Treasure token if you committed a crime this turn."),
    commanderCard("kaleidoscope", "Fixture Diamond Kaleidoscope", [], "Artifact", "Pay three mana: Target creature becomes the color of your choice until end of turn."),
    commanderCard("boulder", "Fixture Boulder Equipment", [], "Artifact - Equipment", "Equipped creature gets +2/+0. Equip 2."),
  ];

  for (const card of fixtures) {
    const signals = classifyCardRoleSignals(card);
    assert.equal(signals.some((signal) => signal.role === "mana-fixing" && signal.confidenceScore >= 0.55), false, card.name);
    assert.equal(signals.some((signal) => signal.role === "color-fixing" && signal.confidenceScore >= 0.55), false, card.name);
  }
});

test("owned discovery candidates with unknown legality cannot produce a completed Commander build", () => {
  const commander = {
    ...commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]),
    typeLine: "Legendary Creature - Goblin Warrior",
    oracleText: "Tap: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.",
  };
  const unknownLegalityCollection = [commander, ...krenkoCandidatePool().map((card) => {
    const { legalities: _legalities, ...rest } = card;
    return rest;
  })];
  const result = constructValidatedCommanderDeck({
    commander,
    collection: unknownLegalityCollection,
    intentId: "no-purchases",
    strategyId: "krenko-go-wide-goblins",
  });

  assert.notEqual(result.generationStatus, "complete");
  assert.equal(result.requirements.every((requirement) => requirement.legalities?.commander === "legal"), true);
  assert.ok(Object.values(result.diagnostics?.rejectionCounts ?? {}).reduce((sum, count) => sum + count, 0) > 0);
});

test("card metadata audit flags malformed final-build candidates", () => {
  const issues = cardMetadataIssues({
    inventoryId: "bad",
    name: "Malformed Fixture",
    quantityOwned: 1,
    typeLine: "",
    oracleText: "",
    colorIdentity: undefined,
    legalities: {},
    marketPrice: null,
  } as CollectionGraphCard);

  assert.ok(issues.includes("missing-color-identity"));
  assert.ok(issues.includes("missing-commander-legality"));
  assert.ok(issues.includes("missing-type-line"));
});

test("professional role classification separates ramp, treasure, cost reduction, and color fixing", () => {
  const signet = classifyCardRoles(commanderCard("arcane-signet", "Arcane Signet", [], "Artifact", "Tap: Add one mana of any color in your commander's color identity."));
  const prospector = classifyCardRoles(commanderCard("skirk", "Skirk Prospector", ["R"], "Creature - Goblin", "Sacrifice a Goblin: Add red mana."));
  const warchief = classifyCardRoles(commanderCard("warchief", "Goblin Warchief", ["R"], "Creature - Goblin", "Goblin spells you cast cost 1 less to cast. Goblins you control have haste."));
  const conditionalTreasure = classifyCardRoleSignals(commanderCard("contract", "Contract Hero", ["R"], "Creature - Human", "When this creature enters, create a Treasure token if you committed a crime this turn."));

  assert.ok(signet.includes("mana-rock"));
  assert.ok(signet.includes("color-fixing"));
  assert.ok(prospector.includes("ramp"));
  assert.ok(prospector.includes("treasure-generation") === false);
  assert.ok(warchief.includes("cost-reduction"));
  assert.equal(conditionalTreasure.find((signal) => signal.role === "treasure-generation")?.confidence, "low");
  assert.equal(conditionalTreasure.find((signal) => signal.role === "ramp")?.confidence, "low");
});

test("Mana Fixing requires repeatable color access instead of incidental mana words", () => {
  const badFixtures = [
    commanderCard("gravestone-strider", "Gravestone Strider", ["R"], "Creature - Elemental", "When it enters, return target land card from your graveyard to your hand."),
    commanderCard("goblin-airbrusher", "Goblin Airbrusher", ["R"], "Creature - Goblin Artificer", "When Goblin Airbrusher enters the battlefield, if you committed a crime this turn, create a Treasure token."),
    commanderCard("long-bodied-grey-dog", "Long-Bodied Grey Dog", ["R"], "Creature - Dog", "Whenever this creature attacks, create a Treasure token if you committed a crime this turn."),
    commanderCard("buy-your-silence", "Buy Your Silence", ["B"], "Sorcery", "Destroy target creature. Create a Treasure token if you committed a crime this turn."),
    commanderCard("lotus-guardian", "Lotus Guardian", [], "Artifact Creature - Dragon", "Flying. When Lotus Guardian enters, you may return target artifact card from your graveyard to your hand."),
    commanderCard("salvaged-manaworker", "Salvaged Manaworker", [], "Artifact Creature - Construct", "When Salvaged Manaworker dies, add one mana of any color. Spend this mana only to cast artifact spells."),
    commanderCard("helionaut", "Helionaut", ["W"], "Creature - Human Soldier", "Flying. When Helionaut enters, add one mana of any color. Spend this mana only to cast a creature spell."),
  ];

  for (const card of badFixtures) {
    const roles = classifyCardRoles(card);
    const signals = classifyCardRoleSignals(card);
    assert.equal(roles.includes("mana-fixing"), false, card.name);
    assert.equal(roles.includes("color-fixing"), false, card.name);
    assert.equal(signals.some((signal) => signal.role === "ramp" && signal.confidence === "high"), false, card.name);
  }
});

test("mono-color Commander decks do not create a Mana Fixing support package", () => {
  const commander = {
    ...commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]),
    typeLine: "Legendary Creature - Goblin Warrior",
    oracleText: "Tap: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.",
  };
  const result = constructValidatedCommanderDeck({
    commander,
    collection: [],
    intentId: "strongest-possible",
    strategyId: "krenko-go-wide-goblins",
    globalCandidates: krenkoCandidatePool(),
    candidateSource: "global-fixture",
  });
  const nonlandFixers = result.requirements.filter((requirement) =>
    !requirement.roles.includes("land") &&
    (requirement.roles.includes("mana-fixing") || requirement.roles.includes("color-fixing")),
  );
  const path = result.requirements.find((requirement) => requirement.name === "Path of Ancestry");

  assert.equal(nonlandFixers.length, 0);
  assert.equal(path?.roles.includes("mana-fixing"), false);
  assert.equal(path?.roles.includes("utility-mana"), true);
});

test("Commander Spellbook provider normalizes combos and degrades gracefully on provider failure", async () => {
  const payload = {
    results: {
      included: [{
        id: "combo-1",
        status: "OK",
        uses: [
          { card: { name: "Krenko, Mob Boss" }, mustBeCommander: true },
          { card: { name: "Skirk Prospector" } },
        ],
        produces: [{ feature: { name: "Infinite mana" } }],
        description: "Tap Krenko.\nSacrifice Goblins.",
        legalities: { commander: true },
        popularity: 12,
      }],
      almostIncluded: [{
        id: "combo-2",
        status: "OK",
        uses: [
          { card: { name: "Krenko, Mob Boss" }, mustBeCommander: true },
          { card: { name: "Thornbite Staff" } },
        ],
        produces: [{ feature: { name: "Infinite damage" } }],
        legalities: { commander: true },
      }],
    },
  };
  const normalized = normalizeSpellbookPayload(payload, ["Krenko, Mob Boss", "Skirk Prospector"], ["Thornbite Staff"]);
  assert.equal(normalized.summary.complete, 1);
  assert.equal(normalized.summary.nearCombos, 1);
  assert.equal(normalized.summary.fullyOwned, 1);
  assert.equal(normalized.summary.winLineCount, 2);

  const provider = new CommanderSpellbookProvider({
    fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }) as Response,
    logger: { info() {}, warn() {}, error() {} },
  });
  const fallback = await provider.findCombosForDeck(["Krenko, Mob Boss"]);
  assert.equal(fallback.available, false);
  assert.match(fallback.message ?? "", /temporarily unavailable/i);
});

test("Trading Docks corpus requires adequate samples and keeps EDHREC as licensed-only placeholder", async () => {
  assert.equal(EDHREC_INTEGRATION_STATUS.integrated, false);
  assert.equal(EDHREC_INTEGRATION_STATUS.scrapingAllowed, false);
  assert.equal(EDHREC_INTEGRATION_STATUS.status, "disabled_unlicensed");

  const provider = new TradingDocksCorpusMetaProvider([
    {
      commanderId: "Krenko, Mob Boss",
      format: "commander",
      archetypeId: "krenko-goblin-swarm",
      strategyId: "krenko-go-wide-goblins",
      cardId: "Skirk Prospector",
      cardName: "Skirk Prospector",
      observedDeckCount: 20,
      eligibleDeckCount: 20,
      coOccurrenceCount: 18,
      baselineInclusionRate: 0.1,
      observedAt: "2026-08-17T00:00:00.000Z",
      sourceCategory: "trading-docks-curated",
      provenance: ["fixture"],
    },
    {
      commanderId: "Krenko, Mob Boss",
      format: "commander",
      archetypeId: "krenko-goblin-swarm",
      strategyId: "krenko-go-wide-goblins",
      cardId: "Impact Tremors",
      cardName: "Impact Tremors",
      observedDeckCount: 40,
      eligibleDeckCount: 50,
      coOccurrenceCount: 34,
      baselineInclusionRate: 0.2,
      observedAt: "2026-08-17T00:00:00.000Z",
      sourceCategory: "trading-docks-curated",
      provenance: ["fixture"],
    },
  ]);
  const lowSample = await provider.getCardEvidence("Krenko, Mob Boss", "Skirk Prospector", "krenko-go-wide-goblins");
  const adequateSample = await provider.getCardEvidence("Krenko, Mob Boss", "Impact Tremors", "krenko-go-wide-goblins");

  assert.equal(lowSample?.classification, "unsupported");
  assert.equal(lowSample?.inclusionRate, null);
  assert.equal(adequateSample?.classification, "core");
  assert.equal(adequateSample?.inclusionRate, 0.8);
  assert.equal(adequateSample?.synergyLift, 0.6000000000000001);
  assert.equal(adequateSample?.sourceDate, "2026-08-17T00:00:00.000Z");
  assert.equal(typeof adequateSample?.freshnessDays, "number");
});

test("professional evidence gate rejects legal low-evidence cards and accepts corpus-backed cards", () => {
  const weakEvidence = buildRecommendationEvidence(
    commanderCard("grey-dog", "Long-Bodied Grey Dog", ["R"], "Creature - Dog", "Whenever this creature attacks, create a Treasure token if you committed a crime this turn."),
    {
      category: "reject",
      score: 0,
      tags: [],
      primaryRoles: [],
      secondaryRoles: [],
      reasons: ["No defensible archetype signal."],
    },
    {
      commander: commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]),
      archetype: null,
      strategy: null,
      intentId: "strongest-possible",
      ownedQuantity: 0,
      source: "inferred",
    },
  );
  const corpusEvidence = buildRecommendationEvidence(
    commanderCard("impact", "Impact Tremors", ["R"], "Enchantment", "Whenever a creature enters the battlefield under your control, Impact Tremors deals 1 damage to each opponent."),
    {
      category: "core",
      score: 92,
      tags: ["goblin-token-maker"],
      primaryRoles: ["synergy"],
      secondaryRoles: [],
      reasons: ["Corpus-backed core Goblin Swarm payoff."],
    },
    {
      commander: commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]),
      archetype: {
        id: "krenko-goblin-swarm",
        label: "Goblin Swarm",
        description: "Fixture archetype.",
        requiredTags: ["goblin", "goblin-token-maker"],
        preferredTags: ["token-payoff"],
        discouragedTags: [],
        excludedTags: [],
        roleTargets: {},
        genericCardLimit: 12,
        minimumCoreAndSynergy: 12,
        minimumRelevanceScore: 30,
      },
      strategy: null,
      intentId: "strongest-possible",
      ownedQuantity: 0,
      source: "corpus",
    },
  );

  assert.equal(ProfessionalEvidenceGate.accepts(weakEvidence, "strongest-possible"), false);
  assert.equal(weakEvidence.professionalQuality, "reject");
  assert.equal(ProfessionalEvidenceGate.accepts(corpusEvidence, "strongest-possible"), true);
  assert.match(corpusEvidence.professionalQuality, /verified-core|strong-match|good-support/);
});

test("Deck Architect knowledge provider exposes benchmark archetype profiles before role filling", () => {
  const fixtures = [
    {
      expected: "krenko-goblin-swarm",
      commander: commanderCard("krenko", "Krenko, Mob Boss", ["R"], "Legendary Creature - Goblin Warrior", "Tap: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control."),
      sample: commanderCard("payoff", "Impact Tremors", ["R"], "Enchantment", "Whenever a creature enters the battlefield under your control, Impact Tremors deals 1 damage to each opponent."),
    },
    {
      expected: "graveyard-recursion",
      commander: commanderCard("meren", "Meren of Clan Nel Toth", ["B", "G"], "Legendary Creature - Human Shaman", "Whenever another creature you control dies, get an experience counter. Return target creature card from your graveyard to your hand."),
      sample: commanderCard("recursion", "Victimize", ["B"], "Sorcery", "Return two target creature cards from your graveyard to the battlefield. Sacrifice a creature."),
    },
    {
      expected: "spellslinger",
      commander: commanderCard("veyran", "Veyran, Voice of Duality", ["U", "R"], "Legendary Creature - Efreet Wizard", "Magecraft - whenever you cast or copy an instant or sorcery spell, Veyran gets +1/+1."),
      sample: commanderCard("spell", "Young Pyromancer", ["R"], "Creature - Human Shaman", "Whenever you cast an instant or sorcery spell, create a 1/1 red Elemental creature token."),
    },
    {
      expected: "counters-value",
      commander: commanderCard("ezuri", "Ezuri, Claw of Progress", ["G", "U"], "Legendary Creature - Elf Warrior", "Put +1/+1 counters on another target creature you control."),
      sample: commanderCard("counter", "Evolution Sage", ["G"], "Creature - Elf Druid", "Whenever a land enters the battlefield under your control, proliferate."),
    },
    {
      expected: "artifact-value",
      commander: commanderCard("urza", "Urza, Chief Artificer", ["W", "U", "B"], "Legendary Creature - Human Artificer", "Artifact creatures you control get +2/+2. Create a Construct artifact creature token."),
      sample: commanderCard("artifact", "Sai, Master Thopterist", ["U"], "Legendary Creature - Human Artificer", "Whenever you cast an artifact spell, create a Thopter artifact creature token."),
    },
    {
      expected: "sacrifice-aristocrats",
      commander: commanderCard("korvold", "Korvold, Fae-Cursed King", ["B", "R", "G"], "Legendary Creature - Dragon Noble", "Whenever you sacrifice a permanent, put a +1/+1 counter on Korvold and draw a card."),
      sample: commanderCard("artist", "Blood Artist", ["B"], "Creature - Vampire", "Whenever Blood Artist or another creature dies, target player loses 1 life and you gain 1 life."),
    },
    {
      expected: "voltron",
      commander: commanderCard("wyleth", "Wyleth, Soul of Steel", ["R", "W"], "Legendary Creature - Human Warrior", "Whenever Wyleth attacks, draw a card for each Aura and Equipment attached to it."),
      sample: commanderCard("boots", "Swiftfoot Boots", [], "Artifact - Equipment", "Equipped creature has hexproof and haste. Equip 1."),
    },
    {
      expected: "five-color-value",
      commander: commanderCard("jodah", "Jodah, the Unifier", ["W", "U", "B", "R", "G"], "Legendary Creature - Human Wizard", "Legendary creatures you control get +X/+X. Whenever you cast a legendary spell, reveal cards from the top of your library."),
      sample: commanderCard("fixing", "Chromatic Lantern", [], "Artifact", "Lands you control have tap: Add one mana of any color. Add one mana of any color."),
    },
  ];

  for (const fixture of fixtures) {
    const profile = TRADING_DOCKS_DECK_KNOWLEDGE_PROVIDER.getCommanderProfile(fixture.commander, null, [fixture.sample]);
    const archetype = selectArchetypeProfile(profile, null);
    const evaluation = evaluateCandidate(fixture.sample, archetype);
    assert.equal(archetype?.id, fixture.expected, fixture.commander.name);
    assert.notEqual(evaluation.category, "reject", fixture.sample.name);
  }
});

test("Commander generation rejects illegal off-color banned and non-playable cards before ranking", () => {
  const commander = commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]);
  const result = constructValidatedCommanderDeck({
    commander,
    collection: [],
    intentId: "strongest-possible",
    strategyId: "krenko-go-wide-goblins",
    globalCandidates: [
      commanderCard("blue", "Blue Filler", ["U"], "Creature - Wizard", "Draw a card."),
      { ...commanderCard("banned", "Banned Goblin", ["R"], "Creature - Goblin", "Create a Goblin token."), legalities: { commander: "banned" } },
      { ...commanderCard("token", "Goblin Token", ["R"], "Token Creature - Goblin", "Token"), legalities: { commander: "legal" } },
      ...krenkoCandidatePool(),
    ],
    candidateSource: "global-fixture",
  });
  const names = new Set(result.requirements.map((requirement) => requirement.name));

  assert.equal(names.has("Blue Filler"), false);
  assert.equal(names.has("Banned Goblin"), false);
  assert.equal(names.has("Goblin Token"), false);
  assert.notEqual(result.generationStatus, "failed");
  assert.ok((result.diagnostics?.rejectionCounts["Off-color"] ?? 0) >= 1);
  assert.ok((result.diagnostics?.rejectionCounts.Illegal ?? 0) >= 1);
  assert.ok((result.diagnostics?.rejectionCounts["Non-playable"] ?? 0) >= 1);
});

test("generated requirements use centralized image fallback and never encode unknown price as zero", () => {
  const image = resolveDeckCardImageUri({ name: "Command Tower", imageUri: null });
  assert.match(image, /\/api\/deck-vault\/card-image\?name=Command\+Tower/);

  const result = constructValidatedCommanderDeck({
    commander: commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]),
    collection: [],
    intentId: "strongest-possible",
    strategyId: "krenko-go-wide-goblins",
    globalCandidates: [{ ...commanderCard("unknown", "Unknown Price Goblin Engine", ["R"], "Creature - Goblin", "Create a Goblin token."), marketPrice: null }],
    candidateSource: "global-fixture",
  });
  assert.equal(result.requirements.some((requirement) => requirement.estimatedPrice === 0), false);
  assert.ok(result.requirements.every((requirement) => requirement.imageUri));
});

test("No Purchases Commander generation fails safely when owned cards are insufficient", () => {
  const commander = {
    ...commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]),
    quantityOwned: 1,
    typeLine: "Legendary Creature - Goblin Warrior",
  };
  const result = constructValidatedCommanderDeck({
    commander,
    collection: [commander],
    intentId: "no-purchases",
    strategyId: "krenko-go-wide-goblins",
  });

  assert.equal(result.generationStatus, "failed");
  assert.equal(result.buildability, null);
  assert.ok(result.failure);
  assert.ok(result.warnings.some((warning) => /without purchases/i.test(warning)));
});

test("No Purchases Commander generation stays owned-only when a full pool still lacks role quality", () => {
  const commander = {
    ...commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]),
    quantityOwned: 1,
    typeLine: "Legendary Creature - Goblin Warrior",
  };
  const ownedPool = krenkoCandidatePool(130).map((card) => ({ ...card, quantityOwned: 1, inventoryId: `owned-${card.inventoryId}` }));
  const mountain = commanderCard("owned-mountain", "Mountain", ["R"], "Basic Land - Mountain", "");
  const result = constructValidatedCommanderDeck({
    commander,
    collection: [commander, ...ownedPool, { ...mountain, quantityOwned: 36, marketPrice: 0.05 }],
    intentId: "no-purchases",
    strategyId: "krenko-go-wide-goblins",
  });
  const totalCards = result.requirements.reduce((sum, requirement) => sum + requirement.requiredQuantity, 0);

  assert.equal(result.generationStatus, "draft_shell");
  assert.equal(result.validation.valid, true);
  assert.equal(totalCards, 100);
  assert.equal(result.ownership.every((match) => match.missingQuantity === 0), true);
  assert.equal(result.requirements.some((requirement) => requirement.name === "Impact Tremors"), false);
  assert.equal(result.requirements.some((requirement) => requirement.name.startsWith("Krenko Global Candidate")), true);
  assert.equal(result.qualityGates.roleCoverageAcceptable, false);
});

test("Commander color identity boundaries cover mono two-color three-color five-color and colorless decks", () => {
  const monoRed = commanderCandidate("mono-red", "Mono Red Commander", ["R"]);
  const rakdos = commanderCandidate("rakdos", "Rakdos Commander", ["B", "R"]);
  const grixis = commanderCandidate("grixis", "Grixis Commander", ["U", "B", "R"]);
  const fiveColor = commanderCandidate("five", "Five Color Commander", ["W", "U", "B", "R", "G"]);
  const colorless = commanderCandidate("colorless", "Colorless Commander", []);
  const blueCard = commanderCard("blue", "Blue Card", ["U"], "Instant", "Draw a card.");
  const redCard = commanderCard("red", "Red Card", ["R"], "Instant", "Deal damage.");
  const rakdosCard = commanderCard("br", "Rakdos Card", ["B", "R"], "Creature", "Draw a card.");
  const colorlessCard = commanderCard("rock", "Mind Stone", [], "Artifact", "Add one mana. Draw a card.");

  assert.equal(commanderColorIdentityQuery(monoRed), "id<=R");
  assert.equal(commanderColorIdentityQuery(colorless), "id<=c");
  assert.equal(commanderColorIdentityFits(blueCard, monoRed), false);
  assert.equal(commanderColorIdentityFits(redCard, monoRed), true);
  assert.equal(commanderColorIdentityFits(rakdosCard, rakdos), true);
  assert.equal(commanderColorIdentityFits(blueCard, rakdos), false);
  assert.equal(commanderColorIdentityFits(rakdosCard, grixis), true);
  assert.equal(commanderColorIdentityFits(blueCard, fiveColor), true);
  assert.equal(commanderColorIdentityFits(colorlessCard, colorless), true);
  assert.equal(commanderColorIdentityFits(redCard, colorless), false);
});

test("Use My Collection blends owned support with important missing recommendations", () => {
  const commander = commanderCandidate("atraxa", "Atraxa, Praetors' Voice", ["W", "U", "B", "G"]);
  const ownedSupport = commanderCard("owned-evolution", "Evolution Sage", ["G"], "Creature - Elf Druid", "Whenever a land enters the battlefield under your control, proliferate.");
  const result = constructValidatedCommanderDeck({
    commander,
    collection: [ownedSupport],
    intentId: "use-collection",
    strategyId: "atraxa-counters",
  });

  assert.ok(result.requirements.some((requirement) => requirement.name === "Evolution Sage"));
  assert.ok(result.requirements.some((requirement) => requirement.name === "Hardened Scales"));
  assert.equal(
    result.ownership.find((match) => match.requirement.name === "Evolution Sage")?.status,
    "owned",
  );
  assert.ok(
    (result.ownership.find((match) => match.requirement.name === "Hardened Scales")?.missingQuantity ?? 0) > 0,
  );
});

test("Budget Commander catalog candidates exclude unknown-price recommendations", () => {
  const commander = commanderCandidate("atraxa", "Atraxa, Praetors' Voice", ["W", "U", "B", "G"]);
  const candidates = getCommanderCatalogCandidates({
    commander,
    intentId: "budget",
    strategy: {
      id: "budget-fixture",
      commanderName: commander.name,
      label: "Budget fixture",
      summary: "Budget test fixture.",
      roles: ["synergy"],
      coreCards: [
        { name: "Known Cheap Card", quantity: 1, roles: ["synergy"], estimatedPrice: 1, typeLine: "Creature", colorIdentity: ["G"] },
        { name: "Unknown Price Card", quantity: 1, roles: ["synergy"], estimatedPrice: null, typeLine: "Creature", colorIdentity: ["G"] },
      ],
      confidence: "medium",
      signals: [],
      provenance: ["Test fixture."],
    },
  });

  assert.equal(candidates.some((candidate) => candidate.name === "Known Cheap Card"), true);
  assert.equal(candidates.some((candidate) => candidate.name === "Unknown Price Card"), false);
  assert.ok(candidates.every((candidate) => candidate.estimatedPrice !== null));
});

test("Commander strategy intelligence exposes licensed-provider-ready seams without using EDHREC data", () => {
  const commander = commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]);
  const strategy = rankCommanderStrategiesForCollection(commander, [commander], "strongest-possible")[0]?.strategy ?? null;
  const deckPlan = createCommanderDeckPlan({ commander, strategy, intentId: "strongest-possible", budget: { enabled: false } });
  const packageTargets = buildCommanderPackageTargets({ commander, strategy, deckPlan });
  const result = TRADING_DOCKS_COMMANDER_STRATEGY_INTELLIGENCE_PROVIDER.resolve({
    commander,
    strategy,
    archetype: selectArchetypeProfile(TRADING_DOCKS_DECK_KNOWLEDGE_PROVIDER.getCommanderProfile(commander, strategy, []), strategy),
    deckPlan,
    intentId: "strongest-possible",
    collection: [],
    candidates: krenkoCandidatePool(24),
  });

  assert.equal(result.provider.edhrecStatus, "licensed-provider-ready");
  assert.equal(result.provider.sources.includes("future-edhrec-licensed"), false);
  assert.ok(result.limitations.some((limitation) => /No EDHREC data is scraped/i.test(limitation)));
  assert.ok(packageTargets.some((target) => target.id === "strategy-engines" && target.ideal > target.min));
  assert.ok(result.recommendations.every((recommendation) => recommendation.reasons.length > 0));
  assert.ok(result.recommendations.every((recommendation) => typeof recommendation.synergyScore === "number"));
});

test("selected Commander archetype materially changes strategy-intelligence recommendations", () => {
  const commander = commanderCandidate("atraxa", "Atraxa, Praetors' Voice", ["W", "U", "B", "G"]);
  const candidates = [
    commanderCard("evolution-sage", "Evolution Sage", ["G"], "Creature - Elf Druid", "Whenever a land enters the battlefield under your control, proliferate."),
    commanderCard("hardened-scales", "Hardened Scales", ["G"], "Enchantment", "If one or more counters would be put on a creature you control, that many plus one are put on it instead."),
    commanderCard("glistener-elf", "Glistener Elf", ["G"], "Creature - Phyrexian Elf Warrior", "Infect."),
    commanderCard("blightbelly-rat", "Blightbelly Rat", ["B"], "Creature - Phyrexian Rat", "Toxic 1. When Blightbelly Rat dies, proliferate."),
    commanderCard("generic-draw", "Generic Draw Spell", ["U"], "Instant", "Draw two cards."),
  ];
  const strategies = rankCommanderStrategiesForCollection(commander, candidates, "strongest-possible").map((fit) => fit.strategy);
  const countersStrategy = strategies.find((strategy) => strategy.id === "atraxa-counters") ?? null;
  const poisonStrategy = strategies.find((strategy) => strategy.id === "atraxa-poison") ?? null;
  const countersDeckPlan = createCommanderDeckPlan({ commander, strategy: countersStrategy, intentId: "strongest-possible", budget: { enabled: false } });
  const poisonDeckPlan = createCommanderDeckPlan({ commander, strategy: poisonStrategy, intentId: "strongest-possible", budget: { enabled: false } });
  const counters = TRADING_DOCKS_COMMANDER_STRATEGY_INTELLIGENCE_PROVIDER.resolve({
    commander,
    strategy: countersStrategy,
    archetype: selectArchetypeProfile(TRADING_DOCKS_DECK_KNOWLEDGE_PROVIDER.getCommanderProfile(commander, countersStrategy, candidates), countersStrategy),
    deckPlan: countersDeckPlan,
    intentId: "strongest-possible",
    collection: [],
    candidates,
  });
  const poison = TRADING_DOCKS_COMMANDER_STRATEGY_INTELLIGENCE_PROVIDER.resolve({
    commander,
    strategy: poisonStrategy,
    archetype: selectArchetypeProfile(TRADING_DOCKS_DECK_KNOWLEDGE_PROVIDER.getCommanderProfile(commander, poisonStrategy, candidates), poisonStrategy),
    deckPlan: poisonDeckPlan,
    intentId: "strongest-possible",
    collection: [],
    candidates,
  });
  const countersTop = counters.recommendations.slice(0, 3).map((entry) => entry.card.name);
  const poisonTop = poison.recommendations.slice(0, 3).map((entry) => entry.card.name);

  assert.notDeepEqual(countersTop, poisonTop);
  assert.ok(countersTop.includes("Hardened Scales") || countersTop.includes("Evolution Sage"));
  assert.ok(poisonTop.includes("Glistener Elf") || poisonTop.includes("Blightbelly Rat"));
});

test("Commander strategy intelligence rejects popularity-only recommendations", () => {
  const commander = commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]);
  const strategy = rankCommanderStrategiesForCollection(commander, [commander], "strongest-possible")[0]?.strategy ?? null;
  const deckPlan = createCommanderDeckPlan({ commander, strategy, intentId: "strongest-possible", budget: { enabled: false } });
  const result = TRADING_DOCKS_COMMANDER_STRATEGY_INTELLIGENCE_PROVIDER.resolve({
    commander,
    strategy,
    archetype: selectArchetypeProfile(TRADING_DOCKS_DECK_KNOWLEDGE_PROVIDER.getCommanderProfile(commander, strategy, []), strategy),
    deckPlan,
    intentId: "strongest-possible",
    collection: [],
    candidates: [
      commanderCard("popular-offplan", "Popular Off-Plan Dragon", ["R"], "Creature - Dragon", "Flying. Popular Off-Plan Dragon deals 3 damage to any target."),
    ],
    externalSignals: [{
      cardName: "Popular Off-Plan Dragon",
      source: "licensed-external",
      deckCountConfidence: 1,
      commanderSpecificInclusion: null,
      commanderSpecificSynergy: null,
      archetypeFit: null,
      category: "generic",
      roles: ["threat"],
      highSynergy: false,
      commonlyPairedWith: [],
      comboRelationships: [],
      reasons: ["High deck-count signal from an authorized provider."],
      provenance: ["Licensed fixture."],
    }],
  });

  assert.equal(result.recommendations.some((recommendation) => recommendation.card.name === "Popular Off-Plan Dragon"), false);
});

test("Commander strategy intelligence emits package recommendations and cut candidates", () => {
  const commander = commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]);
  const strategy = rankCommanderStrategiesForCollection(commander, [commander], "strongest-possible")[0]?.strategy ?? null;
  const deckPlan = createCommanderDeckPlan({ commander, strategy, intentId: "strongest-possible", budget: { enabled: false } });
  const providerInput = {
    commander,
    strategy,
    archetype: selectArchetypeProfile(TRADING_DOCKS_DECK_KNOWLEDGE_PROVIDER.getCommanderProfile(commander, strategy, []), strategy),
    deckPlan,
    intentId: "strongest-possible" as const,
    collection: [],
    candidates: krenkoCandidatePool(30),
    currentRequirements: [
      requirement("weak", "Weak Off-Plan Spell", 1, 1, false, ["interaction"], "Sorcery"),
      requirement("impact", "Impact Tremors", 1, 1, false, ["synergy"], "Enchantment"),
    ],
  };
  const result = TRADING_DOCKS_COMMANDER_STRATEGY_INTELLIGENCE_PROVIDER.resolve(providerInput);

  assert.ok(result.packageTargets.some((target) => target.id === "ramp"));
  assert.ok(result.packageTargets.some((target) => target.id === "strategy-engines"));
  assert.ok(result.recommendations.some((recommendation) => recommendation.packageId === "strategy-engines" || recommendation.packageId === "synergy-payoffs"));
  assert.ok(result.cuts.some((cut) => cut.cardName === "Weak Off-Plan Spell"));
  assert.ok(result.cuts.every((cut) => cut.reasons.length > 0));
});

test("Deck Architect taxonomy detects strategies themes typal and mechanics from real card text", () => {
  const taxonomy = detectCardTaxonomy({
    name: "Atraxa, Praetors' Voice",
    typeLine: "Legendary Creature - Phyrexian Angel Horror",
    oracleText: "Flying, vigilance, deathtouch, lifelink. At the beginning of your end step, proliferate.",
  });

  assert.ok(taxonomy.strategies.includes("Counters"));
  assert.ok(taxonomy.themes.includes("Counters"));
  assert.ok(taxonomy.mechanics.includes("Proliferate"));
  assert.ok(taxonomy.typal.includes("Phyrexian"));
  assert.ok(taxonomy.typal.includes("Angel"));
});

test("Master Brewer parses natural language into structured constraints", () => {
  const constraints = parseBrewRequest("Make this more resilient, use more cards I own, no infinite combos, and cut expensive staples.");

  assert.ok(constraints.some((constraint) => constraint.key === "more-resilient"));
  assert.ok(constraints.some((constraint) => constraint.key === "collection-first"));
  assert.ok(constraints.some((constraint) => constraint.key === "avoid-infinite-combos"));
  assert.ok(constraints.some((constraint) => constraint.key === "budget-cap"));
});

test("Hidden Synergy detects deterministic relationship clusters", () => {
  const requirements: DeckRequirement[] = [
    requirement("seer", "Viscera Seer", 1, 0.5, false, ["sacrifice-outlet"], "Creature - Vampire Wizard"),
    requirement("token", "Ophiomancer", 1, 4, false, ["token-generation"], "Creature - Human Shaman"),
    {
      ...requirement("payoff", "Zulaport Cutthroat", 1, 1, false, ["synergy"], "Creature - Human Rogue Ally"),
      oracleText: "Whenever another creature you control dies, each opponent loses 1 life.",
    },
  ];
  const clusters = detectHiddenSynergies(requirements);

  assert.equal(clusters[0].id, "sacrifice-token-payoff");
  assert.match(clusters[0].summary, /Token production/);
});

test("Deck Personality exposes explainable heuristic dimensions", () => {
  const personality = analyzeDeckPersonality([
    requirement("draw", "Rhystic Study", 1, 38, false, ["card-advantage", "card-draw"], "Enchantment"),
    requirement("counter", "Counterspell", 1, 1, false, ["interaction", "countermagic"], "Instant"),
    requirement("witness", "Eternal Witness", 1, 2, false, ["recursion", "card-advantage"], "Creature - Human Shaman"),
  ]);

  assert.ok(personality.dimensions.interactive > 0);
  assert.ok(personality.dimensions.resilient > 0);
  assert.ok(personality.explanations.every((entry) => /based on visible roles/i.test(entry.detail)));
});

test("Master Brewer proposals are structured and validator-backed", () => {
  const commander = commanderCandidate("atraxa", "Atraxa, Praetors' Voice", ["W", "U", "B", "G"]);
  const constructed = constructValidatedCommanderDeck({
    commander,
    collection: [commander, commanderCard("evolution", "Evolution Sage", ["G"], "Creature - Elf Druid", "Landfall - proliferate.")],
    intentId: "use-collection",
    strategyId: "atraxa-counters",
  });
  const analysis = generateDeckArchitectBrewAnalysis({
    prompt: "What if this were more interactive and less commander-dependent?",
    requirements: constructed.requirements,
    collection: [commander],
    formatId: "commander",
    commander,
    strategy: constructed.strategyFit?.strategy ?? null,
  });

  assert.ok(analysis.parsedConstraints.some((constraint) => constraint.key === "more-interaction"));
  assert.ok(analysis.proposals.length > 0);
  assert.ok(analysis.proposals.every((proposal) => Array.isArray(proposal.suggestedAdds)));
  assert.ok(analysis.proposals.every((proposal) => proposal.validation.issues !== undefined));
  assert.ok(analysis.roleCompression.length > 0);
});

test("Commander construction rejects off-color cards for Rakdos commanders", () => {
  const commander = commanderCandidate("kardum", "Kardum, Patron of Flames", ["B", "R"]);
  const offColorCollection: CollectionGraphCard[] = [
    commander,
    commanderCard("swords", "Swords to Plowshares", ["W"], "Instant", "Exile target creature."),
    commanderCard("rift", "Cyclonic Rift", ["U"], "Instant", "Return target nonland permanent."),
    commanderCard("crop", "Crop Rotation", ["G"], "Instant", "Search your library for a land."),
    commanderCard("nec", "Necropotence", ["B"], "Enchantment", "Draw cards."),
    commanderCard("signet", "Rakdos Signet", [], "Artifact", "Add black and red mana."),
  ];
  const result = constructValidatedCommanderDeck({ commander, collection: offColorCollection, intentId: "strongest-possible" });
  const names = result.requirements.map((requirement) => requirement.name);

  assert.equal(names.includes("Swords to Plowshares"), false);
  assert.equal(names.includes("Cyclonic Rift"), false);
  assert.equal(names.includes("Crop Rotation"), false);
  assert.equal(result.requirements.every((requirement) => commanderColorIdentityFits(requirement, commander)), true);
});

test("Nekusar exposes authored Wheels and Burn strategy profiles", () => {
  const commander = nekusarCommander();
  const strategies = rankCommanderStrategiesForCollection(commander, [], "strongest-possible");
  const strategyIds = strategies.map((fit) => fit.strategy.id);

  assert.equal(strategyIds.includes("nekusar-wheels-group-slug"), true);
  assert.equal(strategyIds.includes("nekusar-burn-draw-punishment"), true);
  assert.equal(strategies[0].strategy.id, "nekusar-wheels-group-slug");
});

test("Wheel and incidental draw classification are materially different", () => {
  const wheel = commanderCard("windfall", "Windfall", ["U"], "Sorcery", "Each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way.");
  const removalCantrip = commanderCard("dismissive-removal", "Dismissive Removal", ["U"], "Instant", "Counter target spell. Draw a card.");
  const wheelRoles = classifyCardRoleSignals(wheel);
  const removalRoles = classifyCardRoleSignals(removalCantrip);

  assert.equal(wheelRoles.some((signal) => signal.role === "wheel" && signal.confidence === "high"), true);
  assert.equal(wheelRoles.some((signal) => signal.role === "hand-cycling" && signal.confidence === "high"), true);
  assert.equal(removalRoles.some((signal) => signal.role === "countermagic" && signal.confidence === "high"), true);
  assert.equal(removalRoles.some((signal) => signal.role === "card-advantage" && signal.confidence === "high"), false);
  assert.equal(removalRoles.some((signal) => signal.role === "incidental-draw"), true);
});

test("Nekusar Wheels Best Possible is evidence-first and does not use random cantrips as the draw package", () => {
  const result = constructValidatedCommanderDeck({
    commander: nekusarCommander(),
    collection: [],
    intentId: "strongest-possible",
    strategyId: "nekusar-wheels-group-slug",
    globalCandidates: nekusarCandidatePool(),
    candidateSource: "global-fixture",
  });
  const nonland = result.requirements.filter((requirement) => requirement.board === "main" && !requirement.roles.includes("land"));
  const names = new Set(nonland.map((requirement) => requirement.name));
  const identityCards = nonland.filter((requirement) =>
    requirement.roles.some((role) => ["wheel", "draw-punishment", "hand-cycling", "group-draw"].includes(role)),
  );
  const firstThirty = nonland.slice(0, 30);

  assert.equal(result.archetypeProfile?.id, "nekusar-wheels-group-slug");
  assert.equal(names.has("Random Removal Cantrip"), false);
  assert.equal(names.has("Random Counter Cantrip"), false);
  assert.equal(identityCards.length >= 10, true);
  assert.equal(firstThirty.every((requirement) => requirement.archetypeCategory !== "reject"), true);
  assert.equal(firstThirty.every((requirement) => requirement.recommendationEvidence?.professionalQuality !== "possible"), true);
  assert.notEqual(result.generationStatus, "complete");
});

test("Nekusar Use My Collection keeps missing core strategy cards over irrelevant owned cards", () => {
  const irrelevantOwned = {
    ...commanderCard("owned-random", "Owned Random Grixis Cantrip", ["U"], "Instant", "Return target creature to its owner's hand. Draw a card."),
    quantityOwned: 1,
  };
  const result = constructValidatedCommanderDeck({
    commander: nekusarCommander(),
    collection: [irrelevantOwned],
    intentId: "use-collection",
    strategyId: "nekusar-wheels-group-slug",
    globalCandidates: nekusarCandidatePool(),
    candidateSource: "global-fixture",
  });
  const names = new Set(result.requirements.map((requirement) => requirement.name));

  assert.equal(names.has("Windfall"), true);
  assert.equal(names.has("Underworld Dreams"), true);
  assert.equal(names.has("Owned Random Grixis Cantrip"), false);
  assert.ok(result.ownership.some((match) => match.requirement.name === "Windfall" && match.missingQuantity > 0));
});

test("Nekusar No Purchases refuses owned filler and returns a draft shell when quality is insufficient", () => {
  const commander = { ...nekusarCommander(), quantityOwned: 1 };
  const ownedWheel = { ...commanderCard("owned-windfall", "Windfall", ["U"], "Sorcery", "Each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way."), quantityOwned: 1 };
  const ownedFiller = { ...commanderCard("owned-filler", "Owned Random Grixis Cantrip", ["U"], "Instant", "Return target creature to its owner's hand. Draw a card."), quantityOwned: 1 };
  const result = constructValidatedCommanderDeck({
    commander,
    collection: [commander, ownedWheel, ownedFiller],
    intentId: "no-purchases",
    strategyId: "nekusar-wheels-group-slug",
  });
  const names = new Set(result.requirements.map((requirement) => requirement.name));

  assert.equal(result.generationStatus, "draft_shell");
  assert.equal(names.has("Windfall"), true);
  assert.equal(names.has("Owned Random Grixis Cantrip"), false);
  assert.equal(result.ownership.every((match) => match.missingQuantity === 0), true);
});

test("Nekusar Budget Mode preserves strategy identity while excluding over-budget missing cards", () => {
  const expensiveOwned = {
    ...commanderCard("owned-wheel", "Wheel of Fortune", ["R"], "Sorcery", "Each player discards their hand, then draws seven cards."),
    quantityOwned: 1,
    marketPrice: 300,
  };
  const result = constructValidatedCommanderDeck({
    commander: nekusarCommander(),
    collection: [expensiveOwned],
    intentId: "budget",
    strategyId: "nekusar-wheels-group-slug",
    budget: {
      enabled: true,
      maxMissingCardPriceCents: 500,
      maxTotalMissingCardBudgetCents: 5_000,
      strict: true,
    },
    globalCandidates: nekusarCandidatePool(),
    candidateSource: "global-fixture",
  });
  const names = new Set(result.requirements.map((requirement) => requirement.name));
  const identityCards = result.requirements.filter((requirement) =>
    requirement.roles.some((role) => ["wheel", "draw-punishment", "hand-cycling", "group-draw"].includes(role)),
  );

  assert.equal(names.has("Wheel of Fortune"), true);
  assert.equal(result.ownership.find((match) => match.requirement.name === "Wheel of Fortune")?.status, "owned");
  assert.equal(names.has("Expensive Missing Wheel"), false);
  assert.equal(names.has("Unknown Price Wheel"), false);
  assert.ok(identityCards.length >= 6);
});

test("Nekusar Wheels and Burn strategies produce materially different packages", () => {
  const wheels = constructValidatedCommanderDeck({
    commander: nekusarCommander(),
    collection: [],
    intentId: "strongest-possible",
    strategyId: "nekusar-wheels-group-slug",
    globalCandidates: nekusarCandidatePool(),
    candidateSource: "global-fixture",
  });
  const burn = constructValidatedCommanderDeck({
    commander: nekusarCommander(),
    collection: [],
    intentId: "strongest-possible",
    strategyId: "nekusar-burn-draw-punishment",
    globalCandidates: nekusarCandidatePool(),
    candidateSource: "global-fixture",
  });
  const wheelNames = new Set(nonGenericNonlandNames(wheels));
  const burnNames = new Set(nonGenericNonlandNames(burn));
  const overlap = [...wheelNames].filter((name) => burnNames.has(name));

  assert.equal(wheels.archetypeProfile?.id, "nekusar-wheels-group-slug");
  assert.equal(burn.archetypeProfile?.id, "nekusar-burn-draw-punishment");
  assert.ok(wheelNames.has("windfall"));
  assert.ok(burnNames.has("underworld dreams"));
  assert.ok(overlap.length < Math.min(wheelNames.size, burnNames.size));
});

test("Commander strategy packages remain distinct across Nekusar Krenko Atraxa and Muldrotha", () => {
  const nekusar = constructValidatedCommanderDeck({
    commander: nekusarCommander(),
    collection: [],
    intentId: "strongest-possible",
    strategyId: "nekusar-wheels-group-slug",
    globalCandidates: nekusarCandidatePool(),
    candidateSource: "global-fixture",
  });
  const krenko = constructValidatedCommanderDeck({
    commander: commanderCandidate("krenko", "Krenko, Mob Boss", ["R"]),
    collection: [],
    intentId: "strongest-possible",
    strategyId: "krenko-go-wide-goblins",
    globalCandidates: krenkoCandidatePool(),
    candidateSource: "global-fixture",
  });
  const atraxa = constructValidatedCommanderDeck({
    commander: commanderCandidate("atraxa", "Atraxa, Praetors' Voice", ["W", "U", "B", "G"]),
    collection: [],
    intentId: "strongest-possible",
    strategyId: "atraxa-poison",
  });
  const muldrotha = constructValidatedCommanderDeck({
    commander: commanderCandidate("muldrotha", "Muldrotha, the Gravetide", ["B", "G", "U"]),
    collection: [],
    intentId: "strongest-possible",
    strategyId: "muldrotha-permanent-recursion",
  });

  assert.ok(suspiciousOverlap([
    nonGenericNonlandNames(nekusar),
    nonGenericNonlandNames(krenko),
    nonGenericNonlandNames(atraxa),
    nonGenericNonlandNames(muldrotha),
  ]).length <= 2);
});

test("DeckPlan captures commander mechanics before card selection", () => {
  const commander = winotaCommander();
  const strategy = rankCommanderStrategiesForCollection(commander, [], "strongest-possible")[0]?.strategy ?? null;
  const plan = createCommanderDeckPlan({
    commander,
    strategy,
    intentId: "strongest-possible",
    budget: { enabled: false },
  });

  assert.equal(plan.commander, "Winota, Joiner of Forces");
  assert.match(plan.selectedStrategy, /Winota|Combat/);
  assert.ok(plan.keyEnablers.includes("non-human-enabler"));
  assert.ok(plan.keyPayoffs.includes("human-payoff"));
  assert.ok(plan.commanderSpecificMechanicalRequirements.some((requirement) => /Non-Human/i.test(requirement)));
});

test("CardInclusionJustification answers why a card belongs in this commander deck", () => {
  const result = constructValidatedCommanderDeck({
    commander: nekusarCommander(),
    collection: [],
    intentId: "strongest-possible",
    strategyId: "nekusar-wheels-group-slug",
    globalCandidates: nekusarCandidatePool(),
  });
  const windfall = result.requirements.find((requirement) => requirement.name === "Windfall");

  assert.ok(result.deckPlan);
  assert.ok(windfall?.inclusionJustification);
  assert.equal(windfall.inclusionJustification.primaryRole, "wheel");
  assert.ok(windfall.inclusionJustification.commanderRelationship.length > 0);
  assert.ok(windfall.inclusionJustification.strategyRelationship.length > 0);
  assert.ok(windfall.inclusionJustification.confidence >= 0.8);
});

test("pairwise candidate comparison favors commander-plan fit over generic role filling", () => {
  const commander = nekusarCommander();
  const strategy = rankCommanderStrategiesForCollection(commander, [], "strongest-possible")[0]?.strategy ?? null;
  const commanderProfile = TRADING_DOCKS_DECK_KNOWLEDGE_PROVIDER.getCommanderProfile(commander, strategy, []);
  const archetype = selectArchetypeProfile(commanderProfile, strategy);
  const deckPlan = createCommanderDeckPlan({ commander, strategy, intentId: "strongest-possible", budget: { enabled: false } });
  const windfall = nekusarCandidatePool().find((card) => card.name === "Windfall")!;
  const randomCantrip = nekusarCandidatePool().find((card) => card.name === "Random Removal Cantrip")!;
  const leftEvaluation = evaluateCandidate(windfall, archetype);
  const rightEvaluation = evaluateCandidate(randomCantrip, archetype);
  const leftEvidence = buildRecommendationEvidence(windfall, leftEvaluation, { commander, archetype, strategy, intentId: "strongest-possible", source: "curated", ownedQuantity: 0 });
  const rightEvidence = buildRecommendationEvidence(randomCantrip, rightEvaluation, { commander, archetype, strategy, intentId: "strongest-possible", source: "inferred", ownedQuantity: 0 });
  const comparison = compareCommanderCandidates({
    left: { card: windfall, evaluation: leftEvaluation, evidence: leftEvidence },
    right: { card: randomCantrip, evaluation: rightEvaluation, evidence: rightEvidence },
    role: "wheel",
    deckPlan,
  });

  assert.equal(comparison.winner, "left");
  assert.ok(comparison.leftScore > comparison.rightScore);
});

test("DeckCritic flags weak justifications and final review requires revision", () => {
  const commander = nekusarCommander();
  const strategy = rankCommanderStrategiesForCollection(commander, [], "strongest-possible")[0]?.strategy ?? null;
  const deckPlan = createCommanderDeckPlan({ commander, strategy, intentId: "strongest-possible", budget: { enabled: false } });
  const weak: DeckRequirement = {
    id: "main:random-cantrip",
    name: "Random Removal Cantrip",
    requiredQuantity: 1,
    board: "main",
    roles: ["interaction", "cantrip", "incidental-draw"],
    archetypeCategory: "generic",
    typeLine: "Instant",
    oracleText: "Return target creature to its owner's hand. Draw a card.",
    legalities: { commander: "legal" },
  };
  const critique = critiqueCommanderDeck({ deckPlan, requirements: [weak] });
  const review = finalHumanSanityReview({ deckPlan, critique, requirements: [weak] });

  assert.ok(validateDeckCriticOutput(critique));
  assert.ok(critique.weakCards.some((card) => card.severity === "high"));
  assert.equal(review.status, "review_required");
});

test("AI critic provider output is only accepted as structured critique data", () => {
  assert.equal(validateDeckCriticOutput({ weakCards: [], missingFunctions: [], overrepresentedFunctions: [], structuralIssues: [], replacementRequests: [], confidence: 0.7 }), true);
  assert.equal(validateDeckCriticOutput({ weakCards: [], confidence: 1, directCardToAdd: "Black Lotus" }), false);
});

test("Winota benchmark separates non-Human enablers from Human payoffs", () => {
  const commander = winotaCommander();
  const profile = createCommanderMechanicalProfile(commander);
  const result = constructValidatedCommanderDeck({
    commander,
    collection: [],
    intentId: "strongest-possible",
    strategyId: "winota-aggressive-combat",
    globalCandidates: winotaCandidatePool(),
  });
  const nonHumanCount = result.requirements.filter((requirement) => requirement.roles.includes("non-human-enabler")).length;
  const humanCount = result.requirements.filter((requirement) => requirement.roles.includes("human-payoff")).length;

  assert.ok(profile.enablerRoles.includes("non-human-enabler"));
  assert.ok(profile.payoffRoles.includes("human-payoff"));
  assert.equal(result.archetypeProfile?.id, "winota-aggressive-combat");
  assert.ok(nonHumanCount >= 4);
  assert.ok(humanCount >= 4);
  assert.ok(result.finalSanityReview);
});

test("Commander build result includes DeckPlan critique revision and final sanity review", () => {
  const result = constructValidatedCommanderDeck({
    commander: nekusarCommander(),
    collection: [],
    intentId: "strongest-possible",
    strategyId: "nekusar-wheels-group-slug",
    globalCandidates: nekusarCandidatePool(),
  });

  assert.ok(result.deckPlan);
  assert.ok(result.critique);
  assert.ok(Array.isArray(result.revisionHistory));
  assert.ok(result.revisionHistory.length <= 3);
  assert.ok(result.finalSanityReview);
  if (result.generationStatus === "complete") {
    assert.equal(result.finalSanityReview.status, "pass");
  }
});

test("benchmarks expose distinct mechanical profiles for Nekusar Krenko Muldrotha and Atraxa", () => {
  const atraxa = commanderCandidate("atraxa", "Atraxa, Praetors' Voice", ["W", "U", "B", "G"]);
  const profiles = [
    createCommanderMechanicalProfile(nekusarCommander(), rankCommanderStrategiesForCollection(nekusarCommander(), [])[0]?.strategy ?? null),
    createCommanderMechanicalProfile(commanderCandidate("krenko", "Krenko, Mob Boss", ["R"])),
    createCommanderMechanicalProfile(commanderCandidate("muldrotha", "Muldrotha, the Gravetide", ["B", "G", "U"])),
    createCommanderMechanicalProfile(atraxa, { ...rankCommanderStrategiesForCollection(atraxa, [])[0]!.strategy, id: "atraxa-poison", label: "Poison" }),
    createCommanderMechanicalProfile(atraxa, { ...rankCommanderStrategiesForCollection(atraxa, [])[0]!.strategy, id: "atraxa-counters", label: "+1/+1 Counters" }),
  ];
  const metricKeys = profiles.map((profile) => profile.qualityMetrics.map((metric) => metric.key).join(","));

  assert.ok(metricKeys[0].includes("wheel-density"));
  assert.ok(metricKeys[1].includes("goblin-density"));
  assert.ok(metricKeys[2].includes("permanent-density"));
  assert.ok(metricKeys[3].includes("poison-density"));
  assert.ok(metricKeys[4].includes("counter-density"));
});

test("Scryfall potential commanders do not convert missing price into fake zero-dollar market value", () => {
  const commander = scryfallResultToPotentialCommander({
    id: "scryfall-unpriced",
    name: "Unpriced Commander",
    manaValue: 4,
    colors: ["U"],
    colorIdentity: ["U"],
    typeLine: "Legendary Creature - Wizard",
    setCode: "tdo",
    setName: "Trading Docks",
    collectorNumber: "42",
    image: "",
    artCrop: "",
    price: 0,
    gameChanger: false,
  });

  assert.equal(commander.marketPrice, null);
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

test("recommendations produce structured swaps and preserve locked cards", () => {
  const format = getFormatProfile("pauper");
  const requirements: DeckRequirement[] = [
    { id: "locked", name: "Lightning Bolt", requiredQuantity: 4, board: "main", roles: ["interaction"], estimatedPrice: 0.75, typeLine: "Instant", importance: 1.5 },
    { id: "flex", name: "Needle Drop", requiredQuantity: 4, board: "main", roles: ["interaction"], estimatedPrice: 0.2, typeLine: "Instant", importance: 0.5 },
    { id: "missing", name: "Lava Spike", requiredQuantity: 4, board: "main", roles: ["burn", "interaction"], estimatedPrice: 1.25, typeLine: "Sorcery", importance: 1 },
    { id: "land", name: "Mountain", requiredQuantity: 48, board: "main", roles: ["land"], estimatedPrice: 0.05, typeLine: "Basic Land - Mountain" },
  ];
  const recommendations = proposeDeckRecommendations({
    requirements,
    collection,
    format,
    lockedCardIds: new Set(["locked"]),
  });

  assert.ok(recommendations[0].adds.length > 0);
  assert.ok(recommendations[0].cuts.every((cut) => cut.name !== "Lightning Bolt"));
});

test("proposal application is atomic and rejects invalid resulting decks", () => {
  const format = getFormatProfile("pauper");
  const requirements: DeckRequirement[] = [
    { id: "bolt", name: "Lightning Bolt", requiredQuantity: 4, board: "main", roles: ["interaction"], typeLine: "Instant" },
    { id: "mountain", name: "Mountain", requiredQuantity: 56, board: "main", roles: ["land"], typeLine: "Basic Land - Mountain" },
  ];
  const invalid = applyDeckChangeProposal(requirements, {
    id: "bad",
    status: "pending",
    removes: [],
    adds: [{ name: "Lightning Bolt", quantity: 1, reason: "Too many copies.", ownedQuantity: 0, additionalCost: 1 }],
    projectedHealthDelta: null,
    additionalCost: 1,
    explanation: "Invalid extra copy.",
  }, format);
  const valid = applyDeckChangeProposal(requirements, {
    id: "good",
    status: "pending",
    removes: [{ name: "Lightning Bolt", quantity: 1, reason: "Make room." }],
    adds: [{ name: "Chain Lightning", quantity: 1, reason: "Similar burn role.", ownedQuantity: 4, additionalCost: 0 }],
    projectedHealthDelta: null,
    additionalCost: 0,
    explanation: "Valid role swap.",
  }, format);

  assert.equal(invalid.applied, false);
  assert.deepEqual(invalid.requirements, requirements);
  assert.equal(valid.applied, true);
  assert.equal(valid.requirements.find((requirement) => requirement.name === "Chain Lightning")?.requiredQuantity, 1);
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

function commanderCandidate(
  inventoryId: string,
  name: string,
  colorIdentity: CollectionGraphCard["colorIdentity"] = ["G"],
): CollectionGraphCard {
  return {
    inventoryId,
    name,
    quantityOwned: 0,
    typeLine: "Legendary Creature - Human Wizard",
    oracleText: "Whenever you cast a spell, draw a card.",
    colorIdentity,
    marketPrice: null,
    legalities: { commander: "legal" },
  };
}

function nonGenericNonlandNames(result: CommanderGenerationResult) {
  const universal = new Set(["sol ring", "arcane signet", "command tower", "path of ancestry", "swiftfoot boots", "lightning greaves"]);
  return result.requirements
    .filter((requirement) => requirement.board === "main")
    .filter((requirement) => !requirement.roles.includes("land"))
    .filter((requirement) => requirement.archetypeCategory !== "generic")
    .map((requirement) => requirement.name.toLowerCase())
    .filter((name) => !universal.has(name));
}

function suspiciousOverlap(groups: string[][]) {
  const counts = new Map<string, number>();
  for (const group of groups) {
    for (const name of new Set(group)) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, count]) => count >= 2).map(([name]) => name);
}

function commanderCard(
  inventoryId: string,
  name: string,
  colorIdentity: CollectionGraphCard["colorIdentity"],
  typeLine: string,
  oracleText: string,
): CollectionGraphCard {
  return {
    inventoryId,
    name,
    quantityOwned: 1,
    typeLine,
    oracleText,
    colorIdentity,
    marketPrice: 1,
    legalities: { commander: "legal" },
  };
}

function krenkoCandidatePool(count = 78): CollectionGraphCard[] {
  const cards: CollectionGraphCard[] = [
    commanderCard("impact-tremors", "Impact Tremors", ["R"], "Enchantment", "Whenever a creature enters the battlefield under your control, Impact Tremors deals 1 damage to each opponent."),
    commanderCard("shared-animosity", "Shared Animosity", ["R"], "Enchantment", "Whenever a creature you control attacks, it gets +1/+0 for each other attacking creature that shares a creature type with it."),
    commanderCard("skirk-prospector", "Skirk Prospector", ["R"], "Creature - Goblin", "Sacrifice a Goblin: Add red mana."),
    commanderCard("goblin-chieftain", "Goblin Chieftain", ["R"], "Creature - Goblin", "Other Goblin creatures you control get +1/+1 and have haste."),
    { ...commanderCard("unknown-price-goblin", "Unknown Price Goblin Engine", ["R"], "Creature - Goblin", "Create a Goblin token. Draw a card."), marketPrice: null },
    commanderCard("off-color-blue", "Blue Token Advisor", ["U"], "Creature - Advisor", "Create a token."),
  ];
  for (let index = 0; cards.length < count; index += 1) {
    const roleText = index % 7 === 0
      ? "Add one mana. Create a Treasure token."
      : index % 7 === 1
        ? "Draw a card."
        : index % 7 === 2
          ? "Destroy target creature."
          : index % 7 === 3
            ? "Destroy all creatures."
            : index % 7 === 4
              ? "Return target card from your graveyard."
              : index % 7 === 5
                ? "Create two 1/1 red Goblin creature tokens."
                : "Creatures you control get +1/+0 until end of turn.";
    cards.push({
      ...commanderCard(
        `krenko-global-${index}`,
        `Krenko Global Candidate ${index}`,
        ["R"],
        index % 4 === 0 ? "Artifact" : "Creature - Goblin",
        roleText,
      ),
      legalities: { commander: "legal" },
      marketPrice: index % 11 === 0 ? null : 0.5 + (index % 5),
    });
  }
  return cards.map((card) => ({
    ...card,
    legalities: { commander: "legal", ...(card.legalities ?? {}) },
  }));
}

function nekusarCommander(): CollectionGraphCard {
  return {
    ...commanderCandidate("nekusar", "Nekusar, the Mindrazer", ["U", "B", "R"]),
    typeLine: "Legendary Creature - Zombie Wizard",
    oracleText: "At the beginning of each player's draw step, that player draws an additional card. Whenever an opponent draws a card, Nekusar, the Mindrazer deals 1 damage to that player.",
  };
}

function nekusarCandidatePool(): CollectionGraphCard[] {
  return [
    commanderCard("windfall", "Windfall", ["U"], "Sorcery", "Each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way."),
    commanderCard("reforge", "Reforge the Soul", ["R"], "Sorcery", "Each player discards their hand, then draws seven cards."),
    commanderCard("dark-deal", "Dark Deal", ["B"], "Sorcery", "Each player discards all the cards in their hand, then draws that many cards minus one."),
    commanderCard("whispering", "Whispering Madness", ["U", "B"], "Sorcery", "Each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way."),
    commanderCard("winds-change", "Winds of Change", ["R"], "Sorcery", "Each player shuffles the cards from their hand into their library, then draws that many cards."),
    commanderCard("wheel-and-deal", "Wheel and Deal", ["U"], "Instant", "Any number of target opponents each discard their hand, then draw seven cards."),
    commanderCard("underworld", "Underworld Dreams", ["B"], "Enchantment", "Whenever an opponent draws a card, Underworld Dreams deals 1 damage to that player."),
    commanderCard("fate-unraveler", "Fate Unraveler", ["B"], "Enchantment Creature - Hag", "Whenever an opponent draws a card, Fate Unraveler deals 1 damage to that player."),
    commanderCard("spiteful", "Spiteful Visions", ["B", "R"], "Enchantment", "At the beginning of each player's draw step, that player draws an additional card. Whenever a player draws a card, Spiteful Visions deals 1 damage to that player."),
    commanderCard("psychosis", "Psychosis Crawler", [], "Artifact Creature - Phyrexian Horror", "Whenever you draw a card, each opponent loses 1 life."),
    commanderCard("dictate", "Dictate of Kruphix", ["U"], "Enchantment", "At the beginning of each player's draw step, that player draws an additional card."),
    commanderCard("kami", "Kami of the Crescent Moon", ["U"], "Legendary Creature - Spirit", "At the beginning of each player's draw step, that player draws an additional card."),
    commanderCard("liliana-caress", "Liliana's Caress", ["B"], "Enchantment", "Whenever an opponent discards a card, that player loses 2 life."),
    commanderCard("megrim", "Megrim", ["B"], "Enchantment", "Whenever an opponent discards a card, Megrim deals 2 damage to that player."),
    commanderCard("waste-not", "Waste Not", ["B"], "Enchantment", "Whenever an opponent discards a creature card, create a Zombie. Whenever an opponent discards a land card, add black mana. Whenever an opponent discards a noncreature, nonland card, draw a card."),
    commanderCard("notion-thief", "Notion Thief", ["U", "B"], "Creature - Human Rogue", "If an opponent would draw a card except the first one they draw in each of their draw steps, instead that player skips that draw and you draw a card."),
    commanderCard("pricey-missing-wheel", "Expensive Missing Wheel", ["R"], "Sorcery", "Each player discards their hand, then draws seven cards."),
    { ...commanderCard("unknown-price-wheel", "Unknown Price Wheel", ["U"], "Sorcery", "Each player discards their hand, then draws seven cards."), quantityOwned: 0, marketPrice: null },
    commanderCard("random-removal-cantrip", "Random Removal Cantrip", ["U"], "Instant", "Return target creature to its owner's hand. Draw a card."),
    commanderCard("random-counter-cantrip", "Random Counter Cantrip", ["U"], "Instant", "Counter target spell. Draw a card."),
    commanderCard("generic-grixis-card", "Generic Grixis Value Card", ["B", "R"], "Creature - Human Rogue", "When this creature enters, draw a card if an opponent lost life this turn."),
    commanderCard("sol-ring", "Sol Ring", [], "Artifact", "Tap: Add two colorless mana."),
    commanderCard("arcane-signet", "Arcane Signet", [], "Artifact", "Tap: Add one mana of any color in your commander's color identity."),
    commanderCard("izzet-signet", "Izzet Signet", [], "Artifact", "Add blue and red mana."),
    commanderCard("dimir-signet", "Dimir Signet", [], "Artifact", "Add blue and black mana."),
    commanderCard("rakdos-signet", "Rakdos Signet", [], "Artifact", "Add black and red mana."),
    commanderCard("swiftfoot", "Swiftfoot Boots", [], "Artifact - Equipment", "Equipped creature has hexproof and haste."),
    commanderCard("chaos-warp", "Chaos Warp", ["R"], "Instant", "The owner of target permanent shuffles it into their library."),
    commanderCard("feed-swarm", "Feed the Swarm", ["B"], "Sorcery", "Destroy target creature or enchantment an opponent controls."),
    commanderCard("cyclonic-rift", "Cyclonic Rift", ["U"], "Instant", "Return target nonland permanent you don't control to its owner's hand."),
  ].map((card) => ({
    ...card,
    legalities: { commander: "legal", ...(card.legalities ?? {}) },
    marketPrice:
      card.name === "Expensive Missing Wheel" ? 50 :
      card.name === "Unknown Price Wheel" ? null :
      card.marketPrice,
  }));
}

function winotaCommander(): CollectionGraphCard {
  return {
    ...commanderCandidate("winota", "Winota, Joiner of Forces", ["R", "W"]),
    typeLine: "Legendary Creature - Human Warrior",
    oracleText: "Whenever a non-Human creature you control attacks, look at the top six cards of your library. You may put a Human creature card from among them onto the battlefield tapped and attacking.",
  };
}

function winotaCandidatePool(): CollectionGraphCard[] {
  const cards = [
    commanderCard("ornithopter", "Ornithopter", [], "Artifact Creature - Thopter", "Flying."),
    commanderCard("gingerbrute", "Gingerbrute", [], "Artifact Creature - Food Golem", "Haste. Gingerbrute can't be blocked except by creatures with haste."),
    commanderCard("legion-warboss", "Legion Warboss", ["R"], "Creature - Goblin Soldier", "At the beginning of combat on your turn, create a 1/1 red Goblin creature token with haste."),
    commanderCard("selfless-spirit", "Selfless Spirit", ["W"], "Creature - Spirit Cleric", "Sacrifice Selfless Spirit: Creatures you control gain indestructible until end of turn."),
    commanderCard("hunted-witness", "Hunted Witness", ["W"], "Creature - Human", "When Hunted Witness dies, create a 1/1 white Soldier creature token with lifelink."),
    commanderCard("blade-historian", "Blade Historian", ["R", "W"], "Creature - Human Cleric", "Attacking creatures you control have double strike."),
    commanderCard("angraths-marauders", "Angrath's Marauders", ["R"], "Creature - Human Pirate", "If a source you control would deal damage to a permanent or player, it deals double that damage instead."),
    commanderCard("thalias-lancers", "Thalia's Lancers", ["W"], "Creature - Human Knight", "When Thalia's Lancers enters the battlefield, you may search your library for a legendary card."),
    commanderCard("esper-sentinel", "Esper Sentinel", ["W"], "Artifact Creature - Human Soldier", "Whenever an opponent casts their first noncreature spell each turn, draw a card unless that player pays mana."),
    commanderCard("professional-facebreaker", "Professional Face-Breaker", ["R"], "Creature - Human Warrior", "Whenever one or more creatures you control deal combat damage to a player, create a Treasure token."),
    commanderCard("lightning-greaves", "Lightning Greaves", [], "Artifact - Equipment", "Equipped creature has haste and shroud."),
    commanderCard("boros-charm", "Boros Charm", ["R", "W"], "Instant", "Permanents you control gain indestructible until end of turn."),
    commanderCard("arcane-signet-winota", "Arcane Signet", [], "Artifact", "Tap: Add one mana of any color in your commander's color identity."),
    commanderCard("irrelevant-fixer", "Irrelevant Fixing Rock", [], "Artifact", "Tap: Add one mana of any color."),
  ];
  return cards.map((card) => ({
    ...card,
    legalities: { commander: "legal", ...(card.legalities ?? {}) },
  }));
}

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
