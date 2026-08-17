import { classifyCardRoles, classifyCardRoleSignals } from "./card-roles.ts";
import type {
  ArchetypeCandidateCategory,
  ArchetypeProfile,
  CollectionGraphCard,
  CommanderProfile,
  CommanderStrategyProfile,
  DeckArchitectRole,
  DeckStrategyTag,
} from "./types.ts";

export type ArchetypeCandidateEvaluation = {
  category: ArchetypeCandidateCategory;
  score: number;
  tags: DeckStrategyTag[];
  primaryRoles: DeckArchitectRole[];
  secondaryRoles: DeckArchitectRole[];
  reasons: string[];
};

export type DeckKnowledgeProvider = {
  getCommanderProfile: (
    commander: CollectionGraphCard,
    strategy: CommanderStrategyProfile | null,
    collection?: CollectionGraphCard[],
  ) => CommanderProfile;
  evaluateCandidate: (
    card: CollectionGraphCard,
    archetype: ArchetypeProfile | null,
  ) => ArchetypeCandidateEvaluation;
};

export const TRADING_DOCKS_DECK_KNOWLEDGE_PROVIDER: DeckKnowledgeProvider = {
  getCommanderProfile,
  evaluateCandidate,
};

const PRODUCTION_FAILURE_NAMES = [
  "heroes for hire",
  "contract hero",
  "giant's boulder",
  "brass secretary",
  "well of discovery",
  "big wheel",
  "stone-giant of high pass",
];

export function getCommanderProfile(
  commander: CollectionGraphCard,
  strategy: CommanderStrategyProfile | null,
  collection: CollectionGraphCard[] = [],
): CommanderProfile {
  const creatureTypes = creatureTypesFromTypeLine(commander.typeLine);
  const tags = classifyStrategyTags(commander);
  const lowerName = commander.name.toLowerCase();
  const isKrenko = lowerName.includes("krenko") || creatureTypes.includes("Goblin") || tags.includes("goblin-token-maker");
  const viableArchetypes = isKrenko
    ? [krenkoGoblinSwarm(), krenkoGoblinCombo(), sacrificeAristocrats()]
    : [
        ...(strategy ? [archetypeFromStrategy(strategy, commander)] : []),
        graveyardRecursion(),
        spellslinger(),
        countersValue(),
        artifactsValue(),
        sacrificeAristocrats(),
        voltron(),
        fiveColorValue(),
      ];
  const scored = viableArchetypes
    .map((archetype) => ({
      archetype,
      score: scoreArchetypeForCollection(archetype, collection) + scoreArchetypeForCommander(archetype, commander, tags),
    }))
    .sort((left, right) =>
      right.score - left.score ||
      Number(left.archetype.id === "balanced-commander") - Number(right.archetype.id === "balanced-commander") ||
      left.archetype.label.localeCompare(right.archetype.label),
    );
  const selected = strategy
    ? viableArchetypes.find((archetype) => strategyMatchesArchetype(strategy, archetype)) ?? scored[0]?.archetype
    : scored[0]?.archetype;

  return {
    commanderName: commander.name,
    colors: commander.colorIdentity ?? [],
    creatureTypes,
    mechanicalThemes: tags,
    viableArchetypes,
    recommendedArchetypeId: selected?.id ?? viableArchetypes[0]?.id ?? "balanced-commander",
  };
}

export function selectArchetypeProfile(
  profile: CommanderProfile,
  strategy: CommanderStrategyProfile | null,
) {
  if (strategy) {
    const match = profile.viableArchetypes.find((archetype) => strategyMatchesArchetype(strategy, archetype));
    if (match) return match;
  }
  return profile.viableArchetypes.find((archetype) => archetype.id === profile.recommendedArchetypeId) ?? profile.viableArchetypes[0] ?? null;
}

export function classifyStrategyTags(card: Pick<CollectionGraphCard, "name" | "typeLine" | "oracleText">): DeckStrategyTag[] {
  const typeLine = card.typeLine?.toLowerCase() ?? "";
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  const name = card.name.toLowerCase();
  const haystack = `${name} ${typeLine} ${oracleText}`;
  const tags: DeckStrategyTag[] = [];

  if (typeLine.includes("artifact")) tags.push("artifact");
  if (typeLine.includes("goblin") || name.includes("goblin")) tags.push("goblin");
  if (typeLine.includes("goblin") && hasAny(oracleText, ["other goblin", "goblins you control", "goblin creatures"])) tags.push("goblin-payoff", "typal-lord");
  if (hasAll(oracleText, ["create", "goblin", "token"])) tags.push("goblin-token-maker", "token-maker");
  if (hasAll(oracleText, ["whenever", "goblin"]) || oracleText.includes("goblins you control")) tags.push("goblin-payoff");
  if (hasAny(oracleText, ["haste", "gain haste", "have haste"])) tags.push("haste-enabler");
  if (hasAny(oracleText, ["untap target", "untap another", "untap all", "untap equipped", "untap enchanted"])) tags.push("untap-engine");
  if (hasAny(oracleText, ["sacrifice a goblin: add", "sacrifice a creature: add", "add two", "add three"])) tags.push("mana-engine");
  if (hasAny(haystack, ["sacrifice", "altar"])) tags.push("sacrifice-outlet");
  if (hasAny(haystack, ["dies", "whenever a creature dies", "blood artist", "zulaport"])) tags.push("death-payoff");
  if (hasAny(oracleText, ["whenever a creature enters", "creature enters the battlefield under your control", "token you control", "creature token"])) tags.push("token-payoff");
  if (hasAny(haystack, ["draw a card", "draw cards", "impulse", "exile the top", "look at the top", "card advantage"])) tags.push("card-advantage");
  if (hasAny(haystack, ["destroy target", "exile target", "counter target", "damage to any target", "return target"])) tags.push("interaction");
  if (classifyCardRoles(card as CollectionGraphCard).includes("ramp")) tags.push("ramp");
  if (classifyCardRoles(card as CollectionGraphCard).includes("protection")) tags.push("protection");
  if (classifyCardRoles(card as CollectionGraphCard).some((role) => role === "board-wipe" || role === "mass-removal")) tags.push("board-wipe");
  if (hasAny(haystack, ["graveyard", "mill", "surveil", "discard then draw"])) tags.push("graveyard-enabler");
  if (hasAny(haystack, ["from your graveyard", "return target card", "escape", "flashback"])) tags.push("recursion");
  if (hasAny(haystack, ["instant or sorcery", "whenever you cast an instant", "whenever you cast a sorcery"])) tags.push("spellslinger", "spell-payoff");
  if (hasAny(haystack, ["prowess", "magecraft"])) tags.push("prowess", "spell-payoff");
  if (hasAny(haystack, ["+1/+1 counter", "counters on", "double the number of counters"])) tags.push("counters-payoff");
  if (haystack.includes("proliferate")) tags.push("proliferate");
  if (hasAny(haystack, ["equipment", "equipped creature"])) tags.push("equipment-payoff");
  if (hasAny(haystack, ["aura", "enchanted creature"])) tags.push("aura-payoff");
  if (hasAny(haystack, ["commander gets", "equipped creature", "enchanted creature", "double strike", "trample"])) tags.push("voltron");
  if (hasAny(haystack, ["exile another target", "return that card to the battlefield", "blink"])) tags.push("blink-enabler");
  if (hasAny(haystack, ["return target creature card from your graveyard to the battlefield", "reanimate"])) tags.push("reanimation");
  if (hasAny(haystack, ["artifact you control", "whenever an artifact", "artifact spell"])) tags.push("artifact-synergy");

  return [...new Set(tags)];
}

export function evaluateCandidate(
  card: CollectionGraphCard,
  archetype: ArchetypeProfile | null,
): ArchetypeCandidateEvaluation {
  const tags = classifyStrategyTags(card);
  const roleSignals = classifyCardRoleSignals(card);
  const primaryRoles = roleSignals.filter((signal) => signal.confidence === "high").map((signal) => signal.role);
  const secondaryRoles = roleSignals.filter((signal) => signal.confidence === "medium").map((signal) => signal.role);
  if (!archetype) {
    const structural = primaryRoles.some((role) => STRUCTURAL_ROLES.has(role));
    return {
      category: structural ? "generic" : "reject",
      score: structural ? 35 : 0,
      tags,
      primaryRoles,
      secondaryRoles,
      reasons: structural ? ["High-confidence structural role."] : ["No archetype profile selected."],
    };
  }

  const lowerName = card.name.toLowerCase();
  const excludedByName = archetype.excludedNames?.some((name) => lowerName === name) ?? false;
  const excludedByTag = tags.some((tag) => archetype.excludedTags.includes(tag));
  const discouragedCount = tags.filter((tag) => archetype.discouragedTags.includes(tag)).length;
  const requiredHits = tags.filter((tag) => archetype.requiredTags.includes(tag)).length;
  const preferredHits = tags.filter((tag) => archetype.preferredTags.includes(tag)).length;
  const structural = primaryRoles.some((role) => STRUCTURAL_ROLES.has(role));
  const reasons: string[] = [];
  if (excludedByName) reasons.push("Known off-strategy production failure fixture.");
  if (excludedByTag) reasons.push("Contains excluded archetype tags.");
  if (requiredHits) reasons.push(`${requiredHits} required strategy tag${requiredHits === 1 ? "" : "s"}.`);
  if (preferredHits) reasons.push(`${preferredHits} preferred strategy tag${preferredHits === 1 ? "" : "s"}.`);
  if (structural) reasons.push("High-confidence structural role.");

  if (excludedByName || excludedByTag || discouragedCount >= 2) {
    return { category: "reject", score: 0, tags, primaryRoles, secondaryRoles, reasons };
  }

  const score =
    requiredHits * 44 +
    preferredHits * 34 +
    (structural ? 18 : 0) +
    secondaryRoles.filter((role) => STRUCTURAL_ROLES.has(role)).length * 4 -
    discouragedCount * 18;

  const category: ArchetypeCandidateCategory =
    requiredHits >= 2 || (requiredHits >= 1 && preferredHits >= 2)
      ? "core"
      : requiredHits >= 1 || preferredHits >= 2
        ? "synergy"
        : preferredHits >= 1
          ? "support"
          : structural && score >= archetype.minimumRelevanceScore
            ? "generic"
            : "reject";

  return { category, score, tags, primaryRoles, secondaryRoles, reasons: reasons.length ? reasons : ["No defensible archetype signal."] };
}

export function scoreArchetypeForCollection(archetype: ArchetypeProfile, collection: CollectionGraphCard[]) {
  return collection
    .filter((card) => card.quantityOwned > 0)
    .map((card) => evaluateCandidate(card, archetype))
    .filter((evaluation) => evaluation.category !== "reject")
    .reduce((sum, evaluation) => sum + Math.min(20, evaluation.score), 0);
}

function scoreArchetypeForCommander(
  archetype: ArchetypeProfile,
  commander: CollectionGraphCard,
  commanderTags: DeckStrategyTag[],
) {
  const commanderText = `${commander.name} ${commander.typeLine ?? ""} ${commander.oracleText ?? ""}`.toLowerCase();
  const requiredHits = commanderTags.filter((tag) => archetype.requiredTags.includes(tag)).length;
  const preferredHits = commanderTags.filter((tag) => archetype.preferredTags.includes(tag)).length;
  const colorCount = commander.colorIdentity?.length ?? 0;
  const fiveColorBonus = colorCount >= 5 && archetype.id === "five-color-value" ? 80 : 0;
  const fiveColorPenalty = colorCount < 4 && archetype.id === "five-color-value" ? -160 : 0;
  const sacrificeBonus = archetype.id === "sacrifice-aristocrats" && commanderText.includes("sacrifice") ? 90 : 0;
  return requiredHits * 70 + preferredHits * 24 + fiveColorBonus + fiveColorPenalty + sacrificeBonus;
}

function archetypeFromStrategy(strategy: CommanderStrategyProfile | null, commander: CollectionGraphCard): ArchetypeProfile {
  const tags = strategy?.taxonomy ? tagsFromTaxonomy(strategy.taxonomy) : classifyStrategyTags(commander);
  const label = strategy?.label ?? "Balanced Commander";
  return archetype({
    id: strategy?.id ?? "balanced-commander",
    label,
    description: strategy?.summary ?? "Balanced Commander shell using defensible role and strategy signals.",
    requiredTags: tags.slice(0, 3),
    preferredTags: [...tags, "card-advantage", "interaction", "ramp", "protection"],
    roleTargets: strategy?.roleTargets ?? Object.fromEntries((strategy?.roles ?? ["card-advantage", "interaction", "ramp"]).map((role) => [role, { min: 4, ideal: 8 }])),
    genericCardLimit: 18,
    minimumCoreAndSynergy: 14,
    minimumRelevanceScore: 28,
  });
}

function krenkoGoblinSwarm(): ArchetypeProfile {
  return archetype({
    id: "krenko-goblin-swarm",
    label: "Goblin Swarm",
    description: "High Goblin density with token makers, lords, haste, payoffs, and enough real interaction to function.",
    requiredTags: ["goblin", "goblin-token-maker"],
    preferredTags: ["goblin-payoff", "typal-lord", "haste-enabler", "token-payoff", "mana-engine", "sacrifice-outlet", "card-advantage", "interaction", "ramp"],
    discouragedTags: ["artifact-synergy", "voltron", "equipment-payoff"],
    excludedNames: PRODUCTION_FAILURE_NAMES,
    typal: { creatureTypes: ["Goblin"], minSupportCount: 24, idealSupportCount: 32 },
    roleTargets: {
      ramp: { min: 7, ideal: 10 },
      "card-advantage": { min: 6, ideal: 9 },
      interaction: { min: 7, ideal: 10 },
      "token-generation": { min: 10, ideal: 18 },
      synergy: { min: 18, ideal: 28 },
    },
    genericCardLimit: 12,
    minimumCoreAndSynergy: 26,
    minimumRelevanceScore: 30,
  });
}

function krenkoGoblinCombo(): ArchetypeProfile {
  return archetype({
    id: "krenko-goblin-combo",
    label: "Goblin Combo",
    description: "Goblin density plus untap loops, mana engines, sacrifice outlets, and combo protection.",
    requiredTags: ["goblin", "untap-engine", "mana-engine"],
    preferredTags: ["sacrifice-outlet", "goblin-token-maker", "haste-enabler", "protection", "card-advantage", "interaction", "artifact"],
    discouragedTags: ["voltron"],
    excludedNames: PRODUCTION_FAILURE_NAMES,
    typal: { creatureTypes: ["Goblin"], minSupportCount: 18, idealSupportCount: 26 },
    roleTargets: {
      "combo-piece": { min: 8, ideal: 14 },
      ramp: { min: 8, ideal: 12 },
      protection: { min: 4, ideal: 7 },
      interaction: { min: 5, ideal: 8 },
    },
    genericCardLimit: 14,
    minimumCoreAndSynergy: 22,
    minimumRelevanceScore: 30,
  });
}

function graveyardRecursion() {
  return archetype({ id: "graveyard-recursion", label: "Graveyard Recursion", description: "Graveyard setup, recursion engines, sacrifice value, and durable card advantage.", requiredTags: ["graveyard-enabler", "recursion"], preferredTags: ["sacrifice-outlet", "death-payoff", "card-advantage", "interaction", "ramp"], roleTargets: { recursion: { min: 8, ideal: 14 }, "graveyard-interaction": { min: 10, ideal: 16 }, "card-advantage": { min: 7, ideal: 10 } }, genericCardLimit: 16, minimumCoreAndSynergy: 20, minimumRelevanceScore: 28 });
}

function spellslinger() {
  return archetype({ id: "spellslinger", label: "Spellslinger", description: "Instant/sorcery density, spell payoffs, card velocity, and interaction.", requiredTags: ["spellslinger", "spell-payoff"], preferredTags: ["prowess", "card-advantage", "interaction", "token-maker", "protection"], roleTargets: { "card-advantage": { min: 9, ideal: 14 }, interaction: { min: 9, ideal: 14 }, "token-generation": { min: 4, ideal: 8 } }, genericCardLimit: 18, minimumCoreAndSynergy: 18, minimumRelevanceScore: 28 });
}

function countersValue() {
  return archetype({ id: "counters-value", label: "+1/+1 Counters", description: "Counter payoffs, proliferate, resilient threats, and value engines.", requiredTags: ["counters-payoff"], preferredTags: ["proliferate", "card-advantage", "interaction", "protection", "ramp"], roleTargets: { synergy: { min: 12, ideal: 20 }, "card-advantage": { min: 7, ideal: 10 }, protection: { min: 4, ideal: 7 } }, genericCardLimit: 16, minimumCoreAndSynergy: 18, minimumRelevanceScore: 28 });
}

function artifactsValue() {
  return archetype({ id: "artifact-value", label: "Artifacts", description: "Artifact density, artifact payoffs, mana engines, and recursion.", requiredTags: ["artifact-synergy", "artifact"], preferredTags: ["mana-engine", "card-advantage", "recursion", "interaction"], roleTargets: { ramp: { min: 8, ideal: 12 }, "card-advantage": { min: 7, ideal: 10 }, synergy: { min: 12, ideal: 20 } }, genericCardLimit: 16, minimumCoreAndSynergy: 20, minimumRelevanceScore: 28 });
}

function sacrificeAristocrats() {
  return archetype({ id: "sacrifice-aristocrats", label: "Sacrifice", description: "Sacrifice outlets, death payoffs, token fodder, and recursion.", requiredTags: ["sacrifice-outlet", "death-payoff"], preferredTags: ["token-maker", "recursion", "card-advantage", "interaction", "goblin"], roleTargets: { "sacrifice-outlet": { min: 7, ideal: 12 }, recursion: { min: 5, ideal: 9 }, "token-generation": { min: 8, ideal: 14 } }, genericCardLimit: 16, minimumCoreAndSynergy: 20, minimumRelevanceScore: 28 });
}

function voltron() {
  return archetype({ id: "voltron", label: "Voltron", description: "Commander damage, protection, equipment or aura support, and efficient interaction.", requiredTags: ["voltron"], preferredTags: ["equipment-payoff", "aura-payoff", "protection", "card-advantage", "interaction"], roleTargets: { protection: { min: 8, ideal: 13 }, interaction: { min: 6, ideal: 9 }, "card-advantage": { min: 5, ideal: 8 } }, genericCardLimit: 18, minimumCoreAndSynergy: 18, minimumRelevanceScore: 28 });
}

function fiveColorValue() {
  return archetype({ id: "five-color-value", label: "Five-Color Value", description: "Color fixing, broad engines, premium interaction, and commander-specific payoffs.", requiredTags: ["ramp", "card-advantage"], preferredTags: ["interaction", "protection", "proliferate", "counters-payoff", "graveyard-enabler", "artifact-synergy"], roleTargets: { ramp: { min: 10, ideal: 14 }, "mana-fixing": { min: 10, ideal: 14 }, "card-advantage": { min: 8, ideal: 12 }, interaction: { min: 8, ideal: 12 } }, genericCardLimit: 22, minimumCoreAndSynergy: 16, minimumRelevanceScore: 25 });
}

function archetype(config: Partial<ArchetypeProfile> & Pick<ArchetypeProfile, "id" | "label" | "description" | "requiredTags" | "preferredTags" | "roleTargets" | "genericCardLimit" | "minimumCoreAndSynergy" | "minimumRelevanceScore">): ArchetypeProfile {
  return {
    discouragedTags: [],
    excludedTags: [],
    ...config,
  };
}

function strategyMatchesArchetype(strategy: CommanderStrategyProfile, archetype: ArchetypeProfile) {
  const text = `${strategy.id} ${strategy.label}`.toLowerCase();
  if (text.includes("swarm") || text.includes("go wide") || text.includes("go-wide") || text.includes("aggro")) return archetype.id === "krenko-goblin-swarm";
  if (text.includes("combo")) return archetype.id === "krenko-goblin-combo";
  return archetype.id === strategy.id || text.includes(archetype.label.toLowerCase());
}

function tagsFromTaxonomy(taxonomy: NonNullable<CommanderStrategyProfile["taxonomy"]>): DeckStrategyTag[] {
  const text = [
    ...taxonomy.primaryArchetypes,
    ...taxonomy.strategies,
    ...taxonomy.themes,
    ...taxonomy.typal,
    ...taxonomy.mechanics,
  ].join(" ").toLowerCase();
  return [
    text.includes("goblin") ? "goblin" : null,
    text.includes("token") ? "token-maker" : null,
    text.includes("graveyard") ? "graveyard-enabler" : null,
    text.includes("spellslinger") ? "spellslinger" : null,
    text.includes("counter") ? "counters-payoff" : null,
    text.includes("proliferate") ? "proliferate" : null,
    text.includes("artifact") ? "artifact-synergy" : null,
  ].filter((tag): tag is DeckStrategyTag => Boolean(tag));
}

function creatureTypesFromTypeLine(typeLine: string | null | undefined) {
  const parts = typeLine?.split(/\s+-\s+/) ?? [];
  return (parts[1]?.trim().split(/\s+/).filter(Boolean) ?? []);
}

function hasAll(value: string, needles: string[]) {
  return needles.every((needle) => value.includes(needle));
}

function hasAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

const STRUCTURAL_ROLES = new Set<DeckArchitectRole>([
  "ramp",
  "mana-fixing",
  "card-advantage",
  "card-draw",
  "interaction",
  "removal",
  "targeted-removal",
  "countermagic",
  "board-wipe",
  "mass-removal",
  "protection",
  "recursion",
]);
