import { evaluateCandidate } from "./archetypes.ts";
import { classifyCardRoles } from "./card-roles.ts";
import { normalizeCardKey } from "./ownership.ts";
import type {
  ArchetypeCandidateCategory,
  BuildIntentId,
  CollectionGraphCard,
  CommanderFunctionalPackageId,
  CommanderFunctionalPackageTarget,
  CommanderStrategyCardSignal,
  CommanderStrategyIntelligenceInput,
  CommanderStrategyIntelligenceProvider,
  CommanderStrategyIntelligenceResult,
  CommanderStrategyRecommendation,
  CommanderStrategySignalSource,
  DeckArchitectRole,
  DeckRequirement,
} from "./types.ts";

const PACKAGE_ROLE_MAP: Record<CommanderFunctionalPackageId, DeckArchitectRole[]> = {
  ramp: ["ramp", "mana-rock", "mana-dork", "ritual", "treasure-generation", "cost-reduction", "mana-fixing", "color-fixing", "land-fixing"],
  "card-advantage": ["card-advantage", "card-draw", "wheel", "group-draw", "conditional-draw", "hand-cycling"],
  interaction: ["interaction", "countermagic", "discard", "graveyard-interaction", "artifact-interaction", "enchantment-interaction"],
  removal: ["removal", "targeted-removal", "mass-removal", "board-wipe"],
  "board-protection": ["protection", "recursion"],
  "strategy-engines": ["synergy", "combo-piece", "token-generation", "untap-engine", "sacrifice-outlet"],
  "synergy-payoffs": ["token-payoff", "goblin-payoff", "human-payoff", "poison", "proliferate", "draw-punishment", "burn", "threat"],
  "win-conditions": ["finisher", "combo-piece", "threat", "burn", "poison", "infect"],
  utility: ["tutor", "utility-mana", "artifact-interaction", "enchantment-interaction", "graveyard-interaction"],
  lands: ["land"],
};

const PACKAGE_LABELS: Record<CommanderFunctionalPackageId, string> = {
  ramp: "Ramp",
  "card-advantage": "Card draw and advantage",
  interaction: "Interaction",
  removal: "Removal",
  "board-protection": "Board protection",
  "strategy-engines": "Strategy engines",
  "synergy-payoffs": "Synergy payoffs",
  "win-conditions": "Win conditions",
  utility: "Utility",
  lands: "Lands",
};

const CATEGORY_SCORE: Record<ArchetypeCandidateCategory, number> = {
  core: 1,
  synergy: 0.78,
  support: 0.52,
  generic: 0.22,
  reject: 0,
};

export class TradingDocksCommanderStrategyIntelligenceProvider implements CommanderStrategyIntelligenceProvider {
  id = "trading-docks-commander-strategy-intelligence";
  name = "Trading Docks Commander Strategy Intelligence";
  supportedSources = [
    "trading-docks-authored",
    "collection-derived",
    "combo-provider",
    "licensed-external",
    "future-edhrec-licensed",
  ] as const;

  resolve(input: CommanderStrategyIntelligenceInput): CommanderStrategyIntelligenceResult {
    const packageTargets = buildCommanderPackageTargets(input);
    const authoredSignals = authoredStrategySignals(input);
    const collectionSignals = collectionDerivedSignals(input);
    const externalSignals = input.externalSignals ?? [];
    const signalMap = mergeSignals([...authoredSignals, ...collectionSignals, ...externalSignals]);
    const recommendations = input.candidates
      .filter((card) => normalizeCardKey(card.name) !== normalizeCardKey(input.commander.name))
      .map((card) => recommendCard(card, input, packageTargets, signalMap.get(normalizeCardKey(card.name)) ?? []))
      .filter((recommendation): recommendation is CommanderStrategyRecommendation => Boolean(recommendation))
      .sort((left, right) => right.priority - left.priority || left.card.name.localeCompare(right.card.name));

    const sources: CommanderStrategySignalSource[] = [...new Set<CommanderStrategySignalSource>([
      ...recommendations.flatMap((recommendation) => recommendation.signals.map((signal) => signal.source)),
      "trading-docks-authored",
      "collection-derived",
    ])];

    return {
      provider: {
        id: this.id,
        name: this.name,
        sources,
        edhrecStatus: "licensed-provider-ready",
      },
      packageTargets,
      recommendations,
      cuts: recommendCuts(input.currentRequirements ?? [], recommendations, input),
      limitations: [
        "No EDHREC data is scraped or used; the EDHREC-shaped seam is licensed-provider-ready only.",
        "Raw popularity and deck-count confidence are capped and cannot override commander, archetype, legality, role, or budget fit.",
        "External recommendation feeds must arrive through authorized provider signals before affecting ranking.",
      ],
    };
  }
}

export const TRADING_DOCKS_COMMANDER_STRATEGY_INTELLIGENCE_PROVIDER = new TradingDocksCommanderStrategyIntelligenceProvider();

export function buildCommanderPackageTargets(input: Pick<CommanderStrategyIntelligenceInput, "commander" | "strategy" | "deckPlan">): CommanderFunctionalPackageTarget[] {
  const colors = input.commander.colorIdentity?.length ?? 0;
  const strategyRoles = new Set(input.strategy?.roles ?? []);
  const roleRange = (roles: DeckArchitectRole[], fallback: { min: number; ideal: number; max?: number }) => {
    const ranges = roles
      .map((role) => input.deckPlan.desiredRoleRanges[role])
      .filter((range): range is { min: number; ideal: number; max?: number } => Boolean(range));
    if (!ranges.length) return fallback;
    return {
      min: Math.max(fallback.min, Math.max(...ranges.map((range) => range.min))),
      ideal: Math.max(fallback.ideal, Math.max(...ranges.map((range) => range.ideal))),
      max: fallback.max,
    };
  };
  const strategyEngineTarget = strategyRoles.has("wheel") || strategyRoles.has("draw-punishment") || strategyRoles.has("group-draw")
    ? { min: 14, ideal: 21, max: 28 }
    : strategyRoles.has("poison") || strategyRoles.has("proliferate")
      ? { min: 13, ideal: 20, max: 27 }
      : strategyRoles.has("goblin-payoff") || strategyRoles.has("token-generation")
        ? { min: 16, ideal: 24, max: 31 }
        : { min: 12, ideal: 18, max: 25 };
  const rampTarget = colors <= 1
    ? { min: 8, ideal: 10, max: 13 }
    : { min: 10, ideal: 13, max: 16 };

  return [
    packageTarget("ramp", roleRange(PACKAGE_ROLE_MAP.ramp, rampTarget), colors <= 1 ? "Mono-color decks need acceleration, not a bloated fixing package." : "Multicolor commanders need acceleration plus reliable color access."),
    packageTarget("card-advantage", roleRange(PACKAGE_ROLE_MAP["card-advantage"], { min: 8, ideal: 11, max: 15 }), "Commander decks need repeatable card flow matched to the selected plan."),
    packageTarget("interaction", roleRange(PACKAGE_ROLE_MAP.interaction, { min: 7, ideal: 10, max: 14 }), "Interaction keeps the deck from goldfishing."),
    packageTarget("removal", roleRange(PACKAGE_ROLE_MAP.removal, { min: 6, ideal: 9, max: 13 }), "Removal coverage is tracked separately from generic interaction."),
    packageTarget("board-protection", roleRange(PACKAGE_ROLE_MAP["board-protection"], { min: 3, ideal: 6, max: 9 }), "Protection and recursion preserve the core engine."),
    packageTarget("strategy-engines", strategyEngineTarget, "The selected commander archetype must own the largest nonland package."),
    packageTarget("synergy-payoffs", { min: 8, ideal: Math.max(12, Math.round(strategyEngineTarget.ideal * 0.62)), max: 20 }, "Payoffs are chosen for the selected archetype instead of generic popularity."),
    packageTarget("win-conditions", { min: 4, ideal: 7, max: 11 }, "Win conditions must connect to the commander plan."),
    packageTarget("utility", { min: 3, ideal: 5, max: 8 }, "Utility cards fill narrow problems after core packages are covered."),
    packageTarget("lands", { min: input.deckPlan.desiredLandRampBehavior.landMin, ideal: Math.round((input.deckPlan.desiredLandRampBehavior.landMin + input.deckPlan.desiredLandRampBehavior.landMax) / 2), max: input.deckPlan.desiredLandRampBehavior.landMax }, "Mana base size follows the commander plan."),
  ];
}

export function packageBucketsFromStrategyIntelligence(result: CommanderStrategyIntelligenceResult): Array<{ roles: DeckArchitectRole[]; target: number }> {
  return result.packageTargets
    .filter((target) => target.id !== "lands")
    .map((target) => ({ roles: target.roles, target: target.ideal }));
}

function packageTarget(
  id: CommanderFunctionalPackageId,
  range: { min: number; ideal: number; max?: number },
  reason: string,
): CommanderFunctionalPackageTarget {
  return {
    id,
    label: PACKAGE_LABELS[id],
    roles: PACKAGE_ROLE_MAP[id],
    min: range.min,
    ideal: range.ideal,
    max: range.max,
    reason,
  };
}

function authoredStrategySignals(input: CommanderStrategyIntelligenceInput): CommanderStrategyCardSignal[] {
  const strategyCards = [
    ...(input.strategy?.coreCards ?? []).map((seed) => ({ seed, category: "core" as const })),
    ...(input.strategy?.flexCards ?? []).map((seed) => ({ seed, category: "synergy" as const })),
  ];
  return strategyCards.map(({ seed, category }) => ({
    cardName: seed.name,
    source: "trading-docks-authored",
    commanderSpecificInclusion: category === "core" ? 0.88 : 0.64,
    commanderSpecificSynergy: category === "core" ? 0.86 : 0.7,
    archetypeFit: category === "core" ? 0.9 : 0.72,
    deckCountConfidence: null,
    category,
    roles: seed.roles,
    highSynergy: category === "core",
    commonlyPairedWith: [input.commander.name],
    comboRelationships: seed.roles.includes("combo-piece") ? [`${seed.name} is marked as a combo or engine card for ${input.strategy?.label ?? input.commander.name}.`] : [],
    budgetBand: priceBand(seed.estimatedPrice ?? null),
    powerBand: "focused",
    reasons: [`Trading Docks-authored ${input.strategy?.label ?? "Commander"} ${category} card.`],
    provenance: ["Trading Docks-authored Commander strategy profile."],
  }));
}

function collectionDerivedSignals(input: CommanderStrategyIntelligenceInput): CommanderStrategyCardSignal[] {
  return input.collection
    .filter((card) => card.quantityOwned > 0)
    .map((card) => ({
      cardName: card.name,
      source: "collection-derived",
      commanderSpecificInclusion: null,
      commanderSpecificSynergy: null,
      archetypeFit: null,
      deckCountConfidence: null,
      category: undefined,
      roles: classifyCardRoles(card),
      highSynergy: false,
      commonlyPairedWith: [],
      comboRelationships: [],
      budgetBand: "unknown",
      powerBand: "unknown",
      reasons: [`Owned copy available in collection (${card.quantityOwned}).`],
      provenance: ["User collection ownership signal."],
    }));
}

function mergeSignals(signals: CommanderStrategyCardSignal[]) {
  const map = new Map<string, CommanderStrategyCardSignal[]>();
  for (const signal of signals) {
    const key = normalizeCardKey(signal.cardName);
    const next = map.get(key) ?? [];
    next.push(signal);
    map.set(key, next);
  }
  return map;
}

function recommendCard(
  card: CollectionGraphCard,
  input: CommanderStrategyIntelligenceInput,
  packages: CommanderFunctionalPackageTarget[],
  signals: CommanderStrategyCardSignal[],
): CommanderStrategyRecommendation | null {
  if (card.legalities?.commander && card.legalities.commander !== "legal") return null;
  const roles = classifyCardRoles(card);
  const evaluation = evaluateCandidate(card, input.archetype);
  if (evaluation.category === "reject") return null;
  const bestPackage = selectBestPackage(roles, packages);
  if (!bestPackage) return null;
  const ownedQuantity = input.collection.find((owned) => normalizeCardKey(owned.name) === normalizeCardKey(card.name))?.quantityOwned ?? card.quantityOwned ?? 0;
  const archetypeFit = clamp01(Math.max(CATEGORY_SCORE[evaluation.category], ...signals.map((signal) => signal.archetypeFit ?? 0)));
  const commanderFit = clamp01(commanderRelationshipScore(card, input) + Math.max(0, ...signals.map((signal) => signal.commanderSpecificSynergy ?? 0)) * 0.46);
  const roleFit = clamp01(roles.filter((role) => bestPackage.roles.includes(role)).length * 0.28 + evaluation.primaryRoles.filter((role) => bestPackage.roles.includes(role)).length * 0.36);
  const selectedArchetypeFit = input.strategy?.roles.some((role) => roles.includes(role) || evaluation.primaryRoles.includes(role)) ? 0.18 : 0;
  const deckCountBonus = Math.min(0.12, Math.max(0, ...signals.map((signal) => signal.deckCountConfidence ?? 0)) * 0.12);
  const comboRelationships = [...new Set(signals.flatMap((signal) => signal.comboRelationships ?? []))];
  const comboBonus = Math.min(0.12, comboRelationships.length * 0.05);
  const ownershipBonus = ownedQuantity > 0 && input.intentId !== "strongest-possible" && input.intentId !== "competitive" ? 0.08 : 0;
  const budgetPenalty = budgetPenaltyForIntent(card, input.intentId);
  const hasSubstantiveStrategyEvidence =
    signals.some((signal) => signal.source === "trading-docks-authored" || signal.source === "collection-derived" || signal.source === "combo-provider") ||
    archetypeFit >= 0.35 ||
    commanderFit >= 0.28 ||
    roleFit >= 0.45 ||
    comboRelationships.length > 0;
  if (!hasSubstantiveStrategyEvidence) return null;
  const hasPopularitySignal = signals.some((signal) => typeof signal.deckCountConfidence === "number");
  const hasTrustedNonPopularitySignal = signals.some((signal) =>
    signal.source === "trading-docks-authored" ||
    signal.source === "collection-derived" ||
    signal.source === "combo-provider" ||
    (signal.commanderSpecificSynergy ?? 0) >= 0.45 ||
    (signal.archetypeFit ?? 0) >= 0.55,
  );
  if (hasPopularitySignal && !hasTrustedNonPopularitySignal && (archetypeFit < 0.68 || commanderFit < 0.34 || roleFit < 0.45)) {
    return null;
  }
  const priority = Math.round((
    archetypeFit * 31 +
    commanderFit * 24 +
    roleFit * 20 +
    selectedArchetypeFit * 100 +
    deckCountBonus * 100 +
    comboBonus * 100 +
    ownershipBonus * 100 -
    budgetPenalty * 100
  ));
  if (priority < 32) return null;
  return {
    card,
    packageId: bestPackage.id,
    role: roles.find((role) => bestPackage.roles.includes(role)) ?? bestPackage.roles[0],
    synergyScore: clamp01((commanderFit * 0.44) + (archetypeFit * 0.38) + (comboBonus * 0.18)),
    archetypeFit,
    commanderFit,
    roleFit,
    ownership: {
      owned: ownedQuantity > 0,
      quantity: Math.max(0, ownedQuantity),
    },
    priority,
    reasons: cardReasons(card, evaluation, input, bestPackage, signals, comboRelationships, ownedQuantity),
    comboRelationships,
    signals,
  };
}

function selectBestPackage(roles: DeckArchitectRole[], packages: CommanderFunctionalPackageTarget[]) {
  return packages
    .filter((target) => target.id !== "lands")
    .map((target) => ({
      target,
      overlap: roles.filter((role) => target.roles.includes(role)).length,
    }))
    .filter((entry) => entry.overlap > 0)
    .sort((left, right) => right.overlap - left.overlap || right.target.ideal - left.target.ideal)[0]?.target ?? null;
}

function commanderRelationshipScore(card: CollectionGraphCard, input: CommanderStrategyIntelligenceInput) {
  const commanderText = `${input.commander.name} ${input.commander.typeLine ?? ""} ${input.commander.oracleText ?? ""}`.toLowerCase();
  const cardText = `${card.name} ${card.typeLine ?? ""} ${card.oracleText ?? ""}`.toLowerCase();
  const taxonomyTerms = [
    ...(input.strategy?.taxonomy?.typal ?? []),
    ...(input.strategy?.taxonomy?.themes ?? []),
    ...(input.strategy?.taxonomy?.strategies ?? []),
    ...(input.strategy?.taxonomy?.mechanics ?? []),
  ].map((term) => term.toLowerCase());
  const taxonomyHits = taxonomyTerms.filter((term) => term && cardText.includes(term)).length;
  const tokenHit = commanderText.includes("token") && /token|creature enters|enters the battlefield/.test(cardText);
  const graveyardHit = /graveyard|return/.test(commanderText) && /graveyard|return|sacrifice|mill/.test(cardText);
  const counterHit = /counter|proliferate/.test(commanderText) && /counter|proliferate|toxic|infect/.test(cardText);
  const spellHit = /instant|sorcery|noncreature/.test(commanderText) && /instant|sorcery|spell|magecraft|prowess/.test(cardText);
  return clamp01(taxonomyHits * 0.18 + (tokenHit ? 0.24 : 0) + (graveyardHit ? 0.24 : 0) + (counterHit ? 0.22 : 0) + (spellHit ? 0.2 : 0));
}

function cardReasons(
  card: CollectionGraphCard,
  evaluation: ReturnType<typeof evaluateCandidate>,
  input: CommanderStrategyIntelligenceInput,
  pkg: CommanderFunctionalPackageTarget,
  signals: CommanderStrategyCardSignal[],
  comboRelationships: string[],
  ownedQuantity: number,
) {
  const reasons = new Set<string>();
  reasons.add(`Fills the ${pkg.label.toLowerCase()} package for ${input.strategy?.label ?? input.commander.name}.`);
  if (evaluation.category === "core") reasons.add("Classified as a core archetype card.");
  if (evaluation.category === "synergy") reasons.add("Classified as a high-synergy archetype card.");
  for (const signal of signals) {
    for (const reason of signal.reasons ?? []) reasons.add(reason);
  }
  if (comboRelationships.length) reasons.add("Has combo or commonly paired relationship evidence.");
  if (ownedQuantity > 0) reasons.add(`Owned in collection (${ownedQuantity}).`);
  if (signals.some((signal) => typeof signal.deckCountConfidence === "number")) {
    reasons.add("Deck-count confidence was treated as supporting evidence only, not as the ranking authority.");
  }
  if (card.marketPrice === null || typeof card.marketPrice === "undefined") reasons.add("Price is unavailable and is not treated as free.");
  return [...reasons].slice(0, 6);
}

function recommendCuts(
  requirements: DeckRequirement[],
  recommendations: CommanderStrategyRecommendation[],
  input: CommanderStrategyIntelligenceInput,
): CommanderStrategyIntelligenceResult["cuts"] {
  const byRole = new Map<DeckArchitectRole, CommanderStrategyRecommendation[]>();
  for (const recommendation of recommendations) {
    const current = byRole.get(recommendation.role) ?? [];
    current.push(recommendation);
    byRole.set(recommendation.role, current);
  }
  return requirements
    .filter((requirement) => !requirement.isCommander && !requirement.roles.includes("land"))
    .map((requirement) => {
      const roles = requirement.roles.length ? requirement.roles : ["synergy" as DeckArchitectRole];
      const strongestAlternatives = roles
        .flatMap((role) => byRole.get(role) ?? [])
        .filter((candidate) => normalizeCardKey(candidate.card.name) !== normalizeCardKey(requirement.name))
        .sort((left, right) => right.priority - left.priority)
        .slice(0, 3);
      const evaluation = evaluateCandidate(requirementToCollectionCard(requirement), input.archetype);
      const lowFit = CATEGORY_SCORE[evaluation.category] < 0.52;
      const redundantRole = strongestAlternatives.length >= 2;
      const poorCurve = typeof requirement.manaCost === "string" && manaValueFromCost(requirement.manaCost) >= input.deckPlan.desiredManaCurve.topEndLimit + 2;
      const priority = (lowFit ? 40 : 0) + (redundantRole ? 22 : 0) + (poorCurve ? 18 : 0);
      return {
        cardName: requirement.name,
        role: roles[0],
        priority,
        reasons: [
          lowFit ? "Low archetype fit for the selected strategy." : null,
          redundantRole ? "Role has stronger available alternatives." : null,
          poorCurve ? "Poor curve contribution for this commander plan." : null,
        ].filter((reason): reason is string => Boolean(reason)),
        strongerAlternatives: strongestAlternatives.map((candidate) => candidate.card.name),
      };
    })
    .filter((cut) => cut.priority >= 40)
    .sort((left, right) => right.priority - left.priority || left.cardName.localeCompare(right.cardName))
    .slice(0, 8);
}

function requirementToCollectionCard(requirement: DeckRequirement): CollectionGraphCard {
  return {
    inventoryId: requirement.id,
    name: requirement.name,
    quantityOwned: 0,
    typeLine: requirement.typeLine,
    oracleText: requirement.oracleText,
    manaCost: requirement.manaCost,
    colorIdentity: requirement.colorIdentity,
    legalities: requirement.legalities,
    marketPrice: requirement.estimatedPrice,
  };
}

function priceBand(price: number | null): CommanderStrategyCardSignal["budgetBand"] {
  if (price === null) return "unknown";
  if (price <= 3) return "budget";
  if (price <= 20) return "mid";
  return "premium";
}

function budgetPenaltyForIntent(card: CollectionGraphCard, intentId: BuildIntentId) {
  if (intentId !== "budget") return 0;
  if (typeof card.marketPrice !== "number") return 0.18;
  if (card.marketPrice <= 3) return 0;
  if (card.marketPrice <= 12) return 0.08;
  return 0.22;
}

function manaValueFromCost(manaCost: string) {
  const generic = manaCost.match(/\{(\d+)\}/g)?.reduce((sum, token) => sum + Number(token.replace(/[{}]/g, "")), 0) ?? 0;
  const symbols = manaCost.match(/\{[WUBRGC]\}/g)?.length ?? 0;
  return generic + symbols;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
