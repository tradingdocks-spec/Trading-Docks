import type {
  CollectionGraphCard,
  CommanderStrategyFit,
  CommanderStrategyProfile,
  DeckArchetypeProfile,
  DeckArchitectFormatId,
  DeckKnowledgeCardSeed,
  DeckRequirement,
  FormatProfile,
  RecommendationConfidence,
  RecommendationSignal,
} from "./types.ts";
import { calculateBuildabilityScore } from "./buildability.ts";
import { getFormatProfile } from "./formats.ts";
import { compareRequirementsToCollection, normalizeCardKey } from "./ownership.ts";
import { validateDeckRequirements } from "./legality.ts";

export const LOCAL_DECK_KNOWLEDGE_PROVIDER = {
  id: "trading-docks-local-deck-knowledge",
  name: "Trading Docks Local Deck Knowledge",
  sourceType: "trading-docks-authored" as const,
  provenance: [
    "Trading Docks-authored archetype requirements and structural rules.",
    "No third-party decklists are copied into the product.",
    "External combo/provider integrations remain behind explicit provider contracts.",
  ],
};

export function supportedRecommendationFormats(): DeckArchitectFormatId[] {
  return ["pauper", "commander"];
}

export function getLocalArchetypes(formatId: DeckArchitectFormatId): DeckArchetypeProfile[] {
  if (formatId !== "pauper") return [];
  return PAUPER_ARCHETYPES;
}

const PAUPER_ARCHETYPES: DeckArchetypeProfile[] = [
  {
    id: "pauper-red-deck-wins",
    name: "Pauper Red Deck Wins",
    formatId: "pauper",
    colors: ["R"],
    summary: "Low-curve red threats backed by burn and reach.",
    roleTargets: {
      threat: { min: 16, ideal: 22 },
      interaction: { min: 12, ideal: 18 },
      removal: { min: 8, ideal: 14 },
      land: { min: 18, ideal: 20 },
    },
    coreCards: [
      seed("Lightning Bolt", 4, ["interaction", "removal"], 0.75, "Instant"),
      seed("Chain Lightning", 4, ["interaction", "removal"], 2.5, "Sorcery"),
      seed("Lava Spike", 4, ["interaction", "removal"], 1.25, "Sorcery"),
      seed("Monastery Swiftspear", 4, ["threat"], 0.6, "Creature - Human Monk"),
      seed("Kessig Flamebreather", 4, ["threat", "synergy"], 0.15, "Creature - Human Shaman"),
      seed("Thermo-Alchemist", 4, ["threat", "synergy"], 0.2, "Creature - Human Shaman"),
    ],
    flexCards: [
      seed("Experimental Synthesizer", 4, ["card-advantage", "synergy"], 0.35, "Artifact"),
      seed("Reckless Impulse", 4, ["card-advantage"], 0.2, "Sorcery"),
      seed("Fireblast", 2, ["finisher", "interaction"], 1.5, "Instant"),
      seed("Needle Drop", 4, ["interaction", "card-advantage"], 0.2, "Instant"),
    ],
    landPlan: [
      seed("Mountain", 18, ["land"], 0.05, "Basic Land - Mountain"),
      seed("Great Furnace", 2, ["land", "mana-fixing"], 1.25, "Artifact Land"),
    ],
    sideboardPlan: [
      seed("Pyroblast", 4, ["interaction", "countermagic"], 4, "Instant"),
      seed("Smash to Smithereens", 3, ["artifact-interaction", "interaction"], 0.2, "Instant"),
      seed("Relic of Progenitus", 3, ["graveyard-interaction"], 1.5, "Artifact"),
    ],
    supportLevel: "full-intelligence",
    provenance: ["Trading Docks-authored Pauper red aggro role profile."],
    sourceType: "trading-docks-authored",
  },
  {
    id: "pauper-bogles",
    name: "Pauper Bogles",
    formatId: "pauper",
    colors: ["G", "W"],
    summary: "Hexproof creatures, efficient auras, and protection.",
    roleTargets: {
      threat: { min: 10, ideal: 14 },
      protection: { min: 8, ideal: 12 },
      synergy: { min: 18, ideal: 24 },
      land: { min: 20, ideal: 22 },
    },
    coreCards: [
      seed("Slippery Bogle", 4, ["threat", "protection"], 1.25, "Creature - Beast"),
      seed("Gladecover Scout", 4, ["threat", "protection"], 0.5, "Creature - Elf Scout"),
      seed("Ethereal Armor", 4, ["synergy", "finisher"], 0.2, "Enchantment - Aura"),
      seed("Rancor", 4, ["synergy", "finisher"], 1.5, "Enchantment - Aura"),
      seed("Ancestral Mask", 4, ["synergy", "finisher"], 0.5, "Enchantment - Aura"),
    ],
    flexCards: [
      seed("Armadillo Cloak", 3, ["synergy", "protection"], 0.35, "Enchantment - Aura"),
      seed("Cartouche of Solidarity", 4, ["synergy"], 0.15, "Enchantment - Aura"),
      seed("Hyena Umbra", 4, ["protection", "synergy"], 0.4, "Enchantment - Aura"),
    ],
    landPlan: [
      seed("Forest", 9, ["land"], 0.05, "Basic Land - Forest"),
      seed("Plains", 5, ["land"], 0.05, "Basic Land - Plains"),
      seed("Ash Barrens", 4, ["land", "mana-fixing"], 0.5, "Land"),
      seed("Blossoming Sands", 4, ["land", "mana-fixing"], 0.05, "Land"),
    ],
    sideboardPlan: [
      seed("Standard Bearer", 3, ["protection", "interaction"], 0.25, "Creature - Human Flagbearer"),
      seed("Young Wolf", 3, ["threat", "protection"], 0.15, "Creature - Wolf"),
      seed("Ram Through", 2, ["targeted-removal", "interaction"], 0.1, "Instant"),
    ],
    supportLevel: "full-intelligence",
    provenance: ["Trading Docks-authored Pauper aura strategy profile."],
    sourceType: "trading-docks-authored",
  },
  {
    id: "pauper-dimir-terror",
    name: "Pauper Dimir Terror",
    formatId: "pauper",
    colors: ["U", "B"],
    summary: "Cheap interaction and cantrips enable under-costed threats.",
    roleTargets: {
      threat: { min: 8, ideal: 12 },
      interaction: { min: 16, ideal: 22 },
      countermagic: { min: 6, ideal: 10 },
      "card-advantage": { min: 10, ideal: 14 },
      land: { min: 18, ideal: 20 },
    },
    coreCards: [
      seed("Tolarian Terror", 4, ["threat", "finisher"], 0.3, "Creature - Serpent"),
      seed("Gurmag Angler", 3, ["threat", "finisher", "graveyard-interaction"], 0.2, "Creature - Zombie Fish"),
      seed("Counterspell", 4, ["interaction", "countermagic"], 0.5, "Instant"),
      seed("Consider", 4, ["card-advantage", "graveyard-interaction"], 0.15, "Instant"),
      seed("Preordain", 4, ["card-advantage"], 0.4, "Sorcery"),
      seed("Snuff Out", 2, ["interaction", "removal"], 4.5, "Instant"),
    ],
    flexCards: [
      seed("Mental Note", 4, ["card-advantage", "graveyard-interaction"], 0.2, "Instant"),
      seed("Thought Scour", 4, ["card-advantage", "graveyard-interaction"], 0.25, "Instant"),
      seed("Cast Down", 2, ["interaction", "removal"], 0.3, "Instant"),
      seed("Spell Pierce", 2, ["interaction", "countermagic"], 0.25, "Instant"),
    ],
    landPlan: [
      seed("Island", 7, ["land"], 0.05, "Basic Land - Island"),
      seed("Swamp", 3, ["land"], 0.05, "Basic Land - Swamp"),
      seed("Contaminated Aquifer", 4, ["land", "mana-fixing"], 0.15, "Land"),
      seed("Ice Tunnel", 4, ["land", "mana-fixing"], 0.15, "Land"),
    ],
    sideboardPlan: [
      seed("Hydroblast", 4, ["interaction", "countermagic"], 1.5, "Instant"),
      seed("Duress", 3, ["discard", "interaction"], 0.2, "Sorcery"),
      seed("Unexpected Fangs", 2, ["lifegain", "protection"], 0.25, "Instant"),
    ],
    supportLevel: "full-intelligence",
    provenance: ["Trading Docks-authored Pauper Dimir spells profile."],
    sourceType: "trading-docks-authored",
  },
];

function seed(
  name: string,
  quantity: number,
  roles: DeckArchetypeProfile["coreCards"][number]["roles"],
  estimatedPrice: number | null,
  typeLine: string,
) {
  return { name, quantity, roles, estimatedPrice, typeLine, importance: 1 };
}

export function inferCommanderStrategies(commander: CollectionGraphCard): CommanderStrategyProfile[] {
  const curated = COMMANDER_STRATEGY_LIBRARY[normalizeCardKey(commander.name)];
  if (curated?.length) {
    return curated.map((strategy) => ({
      ...strategy,
      commanderName: commander.name,
      signals: [
        ...strategy.signals,
        {
          label: "Provider profile",
          impact: "positive",
          detail: "Trading Docks has a structured strategy profile for this commander.",
        },
      ],
    }));
  }

  const text = `${commander.name} ${commander.typeLine ?? ""} ${commander.oracleText ?? ""}`.toLowerCase();
  const strategies: CommanderStrategyProfile[] = [];
  addStrategy(strategies, commander, {
    id: "graveyard-recursion",
    label: "Graveyard recursion",
    summary: "Prioritize self-mill, permanent recursion, and value pieces that can be replayed.",
    roles: ["graveyard-interaction", "card-advantage", "synergy"],
    confidence: matches(text, ["graveyard", "return", "permanent card", "from your graveyard"]) ? "high" : "low",
    active: matches(text, ["graveyard", "return", "permanent card", "from your graveyard"]),
    detail: "Commander text references graveyard or recursion patterns.",
  });
  addStrategy(strategies, commander, {
    id: "counter-synergy",
    label: "Counters and scaling threats",
    summary: "Use counter engines, proliferate effects, and creatures that grow over time.",
    roles: ["synergy", "threat", "card-advantage"],
    confidence: matches(text, ["counter", "proliferate", "+1/+1"]) ? "high" : "low",
    active: matches(text, ["counter", "proliferate", "+1/+1"]),
    detail: "Commander text references counters or proliferate.",
  });
  addStrategy(strategies, commander, {
    id: "token-engine",
    label: "Token engine",
    summary: "Build around token makers, sacrifice outlets, and payoff engines.",
    roles: ["synergy", "combo-piece", "threat"],
    confidence: matches(text, ["create", "token", "populate"]) ? "high" : "low",
    active: matches(text, ["create", "token", "populate"]),
    detail: "Commander text references token creation or token payoffs.",
  });
  addStrategy(strategies, commander, {
    id: "artifact-engine",
    label: "Artifact engine",
    summary: "Lean on artifact ramp, reusable engines, and artifact-count payoffs.",
    roles: ["ramp", "mana-fixing", "synergy"],
    confidence: matches(text, ["artifact", "treasure"]) ? "high" : "low",
    active: matches(text, ["artifact", "treasure"]),
    detail: "Commander text references artifacts or Treasures.",
  });
  addStrategy(strategies, commander, {
    id: "spellslinger",
    label: "Spellslinger",
    summary: "Favor cheap instants, sorceries, card velocity, and spell-count payoffs.",
    roles: ["card-advantage", "interaction", "synergy"],
    confidence: matches(text, ["instant", "sorcery", "noncreature spell", "cast your"]) ? "high" : "low",
    active: matches(text, ["instant", "sorcery", "noncreature spell", "cast your"]),
    detail: "Commander text references instants, sorceries, or noncreature spells.",
  });

  return strategies.length
    ? strategies.sort((left, right) => confidenceRank(right.confidence) - confidenceRank(left.confidence))
    : [{
      id: "goodstuff-balanced",
      commanderName: commander.name,
      label: "Balanced commander shell",
      summary: "Use the commander color identity with a balanced ramp, interaction, draw, and threat package.",
      roles: ["ramp", "interaction", "card-advantage", "threat"],
      confidence: "medium",
      signals: [{
        label: "Fallback strategy",
        impact: "neutral",
        detail: "No strong rules text theme was detected from the available commander metadata.",
      }],
      provenance: ["Trading Docks deterministic commander strategy classifier."],
    }];
}

export function rankCommanderStrategiesForCollection(
  commander: CollectionGraphCard,
  collection: CollectionGraphCard[],
  intentId: string = "use-collection",
): CommanderStrategyFit[] {
  const format = getFormatProfile("commander");
  return inferCommanderStrategies(commander)
    .map((strategy) => {
      const requirements = strategyToRequirements(commander, strategy, format, intentId);
      const validation = validateDeckRequirements(requirements, format, { commander });
      const ownership = compareRequirementsToCollection(requirements, collection, format);
      const buildability = validation.valid ? calculateBuildabilityScore(ownership) : null;
      const missingCoreCards = ownership.filter((match) =>
        match.missingQuantity > 0 &&
        (strategy.coreCards ?? []).some((seedCard) => normalizeCardKey(seedCard.name) === normalizeCardKey(match.requirement.name)),
      );
      const ownedSupportCount = collection.filter((card) =>
        colorIdentityFits(card, commander) &&
        strategy.roles.some((role) => strategyCardRoles(card).includes(role)),
      ).length;
      const score = Math.max(0, Math.min(100,
        (buildability?.score ?? 0) * 0.55 +
        Math.min(25, ownedSupportCount * 3) -
        missingCoreCards.length * 5 +
        intentBonus(intentId, ownership),
      ));
      const fit = score >= 78 ? "strong" : score >= 62 ? "good" : score >= 42 ? "moderate" : "low";
      return {
        commander,
        strategy,
        score: Math.round(score),
        fit,
        ownedSupportCount,
        missingCoreCards,
        estimatedBuildability: buildability,
        signals: [
          {
            label: "Collection fit",
            impact: score >= 62 ? "positive" : score >= 42 ? "neutral" : "negative",
            detail: `${ownedSupportCount} owned cards match ${strategy.label} role signals.`,
          },
          {
            label: "Core gaps",
            impact: missingCoreCards.length <= 2 ? "positive" : "negative",
            detail: `${missingCoreCards.length} core strategy cards are missing.`,
          },
        ],
      } satisfies CommanderStrategyFit;
    })
    .sort((left, right) => right.score - left.score || left.strategy.label.localeCompare(right.strategy.label));
}

function strategyToRequirements(
  commander: CollectionGraphCard,
  strategy: CommanderStrategyProfile,
  format: FormatProfile,
  intentId: string,
) {
  const requirements: DeckRequirement[] = [{
    id: `commander:${commander.inventoryId}`,
    name: commander.name,
    requiredQuantity: 1,
    board: "commander" as const,
    roles: strategy.roles,
    estimatedPrice: commander.marketPrice ?? null,
    imageUri: commander.imageUri,
    typeLine: commander.typeLine,
    oracleText: commander.oracleText,
    manaCost: commander.manaCost,
    colorIdentity: commander.colorIdentity,
    isCommander: true,
    legalities: commander.legalities,
    legalityStatus: "unknown" as const,
  }];
  const seeds = [...(strategy.coreCards ?? []), ...(strategy.flexCards ?? [])];
  let current = 1;
  for (const seedCard of seeds) {
    if (current >= (format.exactDeckSize ?? 100)) break;
    if (intentId === "budget" && (seedCard.estimatedPrice ?? 0) > 25) continue;
    requirements.push({
      id: `strategy:${strategy.id}:${normalizeCardKey(seedCard.name)}`,
      name: seedCard.name,
      requiredQuantity: 1,
      board: "main" as const,
      roles: seedCard.roles,
      estimatedPrice: seedCard.estimatedPrice ?? null,
      importance: seedCard.importance ?? 1,
      typeLine: seedCard.typeLine,
      oracleText: seedCard.oracleText,
      colorIdentity: seedCard.colorIdentity ?? commander.colorIdentity,
      legalityStatus: "unknown" as const,
    });
    current += 1;
  }
  const basicLand = firstCommanderBasic(commander);
  while (current < (format.exactDeckSize ?? 100)) {
    const remaining = (format.exactDeckSize ?? 100) - current;
    requirements.push({
      id: `strategy:${strategy.id}:${normalizeCardKey(basicLand)}:${current}`,
      name: basicLand,
      requiredQuantity: remaining,
      board: "main" as const,
      roles: ["land"] as const,
      estimatedPrice: 0.05,
      typeLine: `Basic Land - ${basicLand}`,
      colorIdentity: commander.colorIdentity?.slice(0, 1) ?? [],
      legalityStatus: "unknown" as const,
    });
    current += remaining;
  }
  return requirements;
}

function firstCommanderBasic(commander: CollectionGraphCard) {
  const color = commander.colorIdentity?.[0];
  if (color === "W") return "Plains";
  if (color === "U") return "Island";
  if (color === "B") return "Swamp";
  if (color === "R") return "Mountain";
  return "Forest";
}

function intentBonus(intentId: string, ownership: ReturnType<typeof compareRequirementsToCollection>) {
  if (intentId === "no-purchases") return ownership.every((match) => match.missingQuantity === 0) ? 15 : -25;
  if (intentId === "use-collection") return 8;
  if (intentId === "budget") {
    const cost = ownership.reduce((sum, match) => sum + (match.estimatedMissingValue ?? 0), 0);
    return cost <= 50 ? 10 : -10;
  }
  if (intentId === "competitive") return 4;
  return 0;
}

function strategyCardRoles(card: CollectionGraphCard) {
  const text = `${card.name} ${card.typeLine ?? ""} ${card.oracleText ?? ""}`.toLowerCase();
  const roles: string[] = [];
  if (matches(text, ["graveyard", "return", "dredge", "escape"])) roles.push("graveyard-interaction", "recursion");
  if (matches(text, ["mill", "surveil"])) roles.push("graveyard-interaction", "card-advantage");
  if (matches(text, ["sacrifice", "dies", "altar"])) roles.push("sacrifice-outlet", "synergy");
  if (matches(text, ["counter", "proliferate", "+1/+1"])) roles.push("synergy", "threat");
  if (matches(text, ["poison", "toxic", "infect"])) roles.push("synergy", "threat");
  if (matches(text, ["planeswalker"])) roles.push("card-advantage", "threat");
  if (matches(text, ["draw", "look at the top"])) roles.push("card-draw", "card-advantage");
  if (matches(text, ["destroy target", "exile target", "counter target"])) roles.push("interaction");
  return roles.length ? roles : ["synergy"];
}

function colorIdentityFits(card: CollectionGraphCard, commander: CollectionGraphCard) {
  const colors = card.colorIdentity ?? [];
  const commanderColors = commander.colorIdentity ?? [];
  return colors.every((color) => commanderColors.includes(color));
}

function libraryStrategy(
  id: string,
  commanderName: string,
  label: string,
  summary: string,
  roles: CommanderStrategyProfile["roles"],
  coreCards: DeckKnowledgeCardSeed[],
  flexCards: DeckKnowledgeCardSeed[],
): CommanderStrategyProfile {
  return {
    id,
    commanderName,
    label,
    summary,
    roles,
    coreCards,
    flexCards,
    roleTargets: Object.fromEntries(roles.map((role) => [role, { min: 6, ideal: 10 }])),
    confidence: "high",
    signals: [{ label: "Strategy profile", impact: "positive", detail: "Structured Trading Docks commander strategy profile." }],
    provenance: ["Trading Docks-authored commander strategy profile."],
  };
}

const COMMANDER_STRATEGY_LIBRARY: Record<string, CommanderStrategyProfile[]> = {
  [normalizeCardKey("Muldrotha, the Gravetide")]: [
    libraryStrategy(
      "muldrotha-permanent-recursion",
      "Muldrotha, the Gravetide",
      "Permanent Recursion",
      "Loop value permanents through the graveyard with efficient self-mill and reusable interaction.",
      ["recursion", "graveyard-interaction", "card-advantage", "synergy"],
      [
        seed("Satyr Wayfinder", 1, ["graveyard-interaction", "mana-fixing"], 0.15, "Creature - Satyr"),
        seed("Seal of Primordium", 1, ["enchantment-interaction", "recursion"], 0.3, "Enchantment"),
        seed("Pernicious Deed", 1, ["mass-removal", "recursion"], 8, "Enchantment"),
        seed("Eternal Witness", 1, ["recursion", "card-advantage"], 2.5, "Creature - Human Shaman"),
      ],
      [
        seed("Stitcher's Supplier", 1, ["graveyard-interaction"], 0.5, "Creature - Zombie"),
        seed("Ramunap Excavator", 1, ["recursion", "land"], 3, "Creature - Naga Cleric"),
      ],
    ),
    libraryStrategy(
      "muldrotha-sacrifice",
      "Muldrotha, the Gravetide",
      "Sacrifice Value",
      "Use sacrifice outlets and recursive permanents to convert board presence into repeated value.",
      ["sacrifice-outlet", "recursion", "synergy", "card-advantage"],
      [
        seed("Viscera Seer", 1, ["sacrifice-outlet"], 0.5, "Creature - Vampire Wizard"),
        seed("Zulaport Cutthroat", 1, ["synergy"], 1, "Creature - Human Rogue Ally"),
        seed("Sakura-Tribe Elder", 1, ["ramp", "recursion"], 0.2, "Creature - Snake Shaman"),
      ],
      [seed("Plaguecrafter", 1, ["interaction", "sacrifice-outlet"], 0.25, "Creature - Human Shaman")],
    ),
    libraryStrategy(
      "muldrotha-self-mill",
      "Muldrotha, the Gravetide",
      "Self-Mill",
      "Load the graveyard quickly, then turn it into a second hand.",
      ["graveyard-interaction", "card-draw", "recursion"],
      [
        seed("Stitcher's Supplier", 1, ["graveyard-interaction"], 0.5, "Creature - Zombie"),
        seed("Mesmeric Orb", 1, ["graveyard-interaction"], 18, "Artifact"),
        seed("Glowspore Shaman", 1, ["graveyard-interaction", "mana-fixing"], 0.15, "Creature - Elf Shaman"),
      ],
      [seed("Mulch", 1, ["graveyard-interaction", "card-advantage"], 0.1, "Sorcery")],
    ),
  ],
  [normalizeCardKey("Atraxa, Praetors' Voice")]: [
    libraryStrategy(
      "atraxa-counters",
      "Atraxa, Praetors' Voice",
      "+1/+1 Counters",
      "Turn proliferate into board growth with resilient counter engines.",
      ["synergy", "threat", "protection"],
      [
        seed("Winding Constrictor", 1, ["synergy"], 0.5, "Creature - Snake"),
        seed("Hardened Scales", 1, ["synergy"], 4, "Enchantment"),
        seed("Evolution Sage", 1, ["synergy"], 1.5, "Creature - Elf Druid"),
      ],
      [seed("Forgotten Ancient", 1, ["threat", "synergy"], 0.5, "Creature - Elemental")],
    ),
    libraryStrategy(
      "atraxa-poison",
      "Atraxa, Praetors' Voice",
      "Poison",
      "Use poison counters and proliferate to pressure the table through alternate win conditions.",
      ["synergy", "threat", "interaction"],
      [
        seed("Inexorable Tide", 1, ["synergy"], 3, "Enchantment"),
        seed("Skrelv's Hive", 1, ["token-generation", "synergy"], 5, "Enchantment"),
        seed("Vraska's Fall", 1, ["discard", "interaction"], 0.2, "Instant"),
      ],
      [seed("Blightbelly Rat", 1, ["synergy"], 0.1, "Creature - Phyrexian Rat")],
    ),
    libraryStrategy(
      "atraxa-superfriends",
      "Atraxa, Praetors' Voice",
      "Superfriends",
      "Protect planeswalkers and multiply loyalty counters through proliferate.",
      ["card-advantage", "protection", "synergy"],
      [
        seed("The Chain Veil", 1, ["combo-piece", "synergy"], 7, "Artifact"),
        seed("Oath of Teferi", 1, ["synergy"], 2, "Legendary Enchantment"),
        seed("Deepglow Skate", 1, ["synergy"], 4, "Creature - Fish"),
      ],
      [seed("Ichormoon Gauntlet", 1, ["synergy", "card-advantage"], 5, "Artifact")],
    ),
  ],
};

function addStrategy(
  strategies: CommanderStrategyProfile[],
  commander: CollectionGraphCard,
  config: {
    id: string;
    label: string;
    summary: string;
    roles: CommanderStrategyProfile["roles"];
    confidence: RecommendationConfidence;
    active: boolean;
    detail: string;
  },
) {
  if (!config.active) return;
  const signal: RecommendationSignal = {
    label: "Commander text",
    impact: "positive",
    detail: config.detail,
  };
  strategies.push({
    id: config.id,
    commanderName: commander.name,
    label: config.label,
    summary: config.summary,
    roles: config.roles,
    confidence: config.confidence,
    signals: [signal],
    provenance: ["Trading Docks deterministic commander strategy classifier."],
  });
}

function matches(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function confidenceRank(confidence: RecommendationConfidence) {
  return confidence === "high" ? 3 : confidence === "medium" ? 2 : 1;
}
