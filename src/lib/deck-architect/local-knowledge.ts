import type {
  CollectionGraphCard,
  CommanderStrategyProfile,
  DeckArchetypeProfile,
  DeckArchitectFormatId,
  RecommendationConfidence,
  RecommendationSignal,
} from "./types.ts";

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
