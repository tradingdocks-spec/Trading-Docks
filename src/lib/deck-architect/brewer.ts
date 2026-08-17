import { calculateBuildabilityScore } from "./buildability.ts";
import { classifyCardRoles } from "./card-roles.ts";
import { getFormatProfile } from "./formats.ts";
import { analyzeDeckHealth } from "./health.ts";
import { validateDeckRequirements } from "./legality.ts";
import { compareRequirementsToCollection, normalizeCardKey } from "./ownership.ts";
import { applyDeckChangeProposal, recommendOwnedSubstitutions } from "./recommendations.ts";
import type {
  BrewConstraint,
  BrewStructuredProposal,
  BuildOpportunity,
  CollectionGraphCard,
  CommanderStrategyProfile,
  DeckArchitectBrewAnalysis,
  DeckArchitectFormatId,
  DeckArchitectRole,
  DeckChangeProposal,
  DeckPersonalityDimension,
  DeckPersonalityReport,
  DeckRequirement,
  HiddenSynergyCluster,
  OwnershipMatch,
  RoleCompressionInsight,
  StrategyOverloadInsight,
} from "./types.ts";

type BrewContext = {
  prompt?: string | null;
  requirements: DeckRequirement[];
  collection: CollectionGraphCard[];
  formatId: DeckArchitectFormatId;
  commander?: CollectionGraphCard | null;
  strategy?: CommanderStrategyProfile | null;
  lockedCardIds?: Set<string>;
  mustIncludeCardIds?: Set<string>;
};

const CONSTRAINT_PATTERNS: Array<{
  key: BrewConstraint["key"];
  label: string;
  detail: string;
  needles: string[];
}> = [
  {
    key: "more-aggressive",
    label: "More aggressive",
    detail: "Prioritize lower curve threats, pressure, and finishers.",
    needles: ["aggressive", "faster", "fast", "pressure", "aggro"],
  },
  {
    key: "more-interaction",
    label: "More interaction",
    detail: "Increase removal, countermagic, and flexible answers.",
    needles: ["interaction", "removal", "answer", "answers", "counterspell", "interactive"],
  },
  {
    key: "more-resilient",
    label: "More resilient",
    detail: "Favor recursion, protection, and recovery after disruption.",
    needles: ["resilient", "recover", "wipe", "board wipe", "grind"],
  },
  {
    key: "reduce-variance",
    label: "Reduce variance",
    detail: "Prefer redundant roles and fewer narrow cards.",
    needles: ["variance", "consistent", "consistency", "repetitive", "fewer repetitive"],
  },
  {
    key: "collection-first",
    label: "Use more owned cards",
    detail: "Prefer owned substitutions before missing recommendations.",
    needles: ["cards i own", "mostly cards", "collection", "owned", "no purchase"],
  },
  {
    key: "budget-cap",
    label: "Lower missing-card cost",
    detail: "Cut expensive missing staples and prefer known-price alternatives.",
    needles: ["budget", "$25", "cheap", "expensive", "cut the expensive"],
  },
  {
    key: "avoid-infinite-combos",
    label: "Avoid infinite combos",
    detail: "Reduce explicit combo-piece reliance and keep lines reviewable.",
    needles: ["no infinite", "avoid infinite", "without infinite"],
  },
  {
    key: "less-commander-dependent",
    label: "Less commander-dependent",
    detail: "Increase standalone card advantage and engines that work without the commander.",
    needles: ["less commander", "without commander", "commander-dependent"],
  },
  {
    key: "add-sacrifice-subtheme",
    label: "Sacrifice subtheme",
    detail: "Explore sacrifice outlets, death triggers, and recursive fodder.",
    needles: ["sacrifice", "aristocrat", "dies", "death trigger"],
  },
  {
    key: "more-unusual",
    label: "More unusual",
    detail: "Look for coherent but less typical role combinations.",
    needles: ["weird", "weirder", "unusual", "surprise", "clever", "less typical"],
  },
];

export function parseBrewRequest(prompt: string | null | undefined): BrewConstraint[] {
  const normalized = prompt?.toLowerCase() ?? "";
  if (!normalized.trim()) return [];
  return CONSTRAINT_PATTERNS
    .filter((entry) => entry.needles.some((needle) => normalized.includes(needle)))
    .map((entry) => ({
      key: entry.key,
      label: entry.label,
      detail: entry.detail,
      confidence: normalized.length > 18 ? "high" : "medium",
    }));
}

export function generateDeckArchitectBrewAnalysis(context: BrewContext): DeckArchitectBrewAnalysis {
  const constraints = parseBrewRequest(context.prompt);
  const format = getFormatProfile(context.formatId);
  const ownership = compareRequirementsToCollection(context.requirements, context.collection, format);
  const health = context.requirements.length ? analyzeDeckHealth(context.requirements, format) : null;
  const hiddenSynergies = detectHiddenSynergies(context.requirements, ownership);
  const personality = analyzeDeckPersonality(context.requirements, context.commander ?? null);
  const roleCompression = detectRoleCompression(context.requirements, ownership);
  const strategyOverload = detectStrategyOverload(context.requirements, context.strategy ?? null);
  const proposals = buildBrewProposals({
    ...context,
    constraints,
    ownership,
    currentHealth: health?.overall ?? null,
  });
  const surpriseDirections = discoverCollectionOpportunities(context.collection, context.formatId);

  return {
    parsedConstraints: constraints,
    hiddenSynergies,
    personality,
    roleCompression,
    strategyOverload,
    proposals,
    surpriseDirections,
  };
}

export function analyzeDeckPersonality(
  requirements: DeckRequirement[],
  commander: CollectionGraphCard | null = null,
): DeckPersonalityReport {
  const main = requirements.filter((card) => card.board !== "commander");
  const roleCount = (role: DeckArchitectRole) =>
    main.filter((card) => card.roles.includes(role)).reduce((sum, card) => sum + card.requiredQuantity, 0);
  const synergy = roleCount("synergy") + roleCount("token-generation") + roleCount("sacrifice-outlet");
  const interaction = roleCount("interaction") + roleCount("removal") + roleCount("countermagic");
  const recursion = roleCount("recursion") + roleCount("protection") + roleCount("graveyard-interaction");
  const combo = roleCount("combo-piece");
  const threat = roleCount("threat") + roleCount("finisher") + roleCount("burn");
  const cardAdvantage = roleCount("card-advantage") + roleCount("card-draw");
  const commanderText = `${commander?.name ?? ""} ${commander?.oracleText ?? ""}`.toLowerCase();
  const commanderDependence = commanderText && main.some((card) => {
    const text = `${card.name} ${card.oracleText ?? ""}`.toLowerCase();
    return text.includes("commander") || text.includes(commander?.name.toLowerCase() ?? "__none__");
  }) ? 72 : Math.max(24, Math.min(68, synergy * 4));

  const dimensions: DeckPersonalityReport["dimensions"] = {
    explosive: score(threat * 5 + combo * 7),
    interactive: score(interaction * 6),
    resilient: score(recursion * 5 + cardAdvantage * 3),
    linear: score(Math.max(synergy, threat) * 5 - interaction * 2),
    political: score(roleCount("protection") * 4 + roleCount("lifegain") * 3),
    "combo-reliance": score(combo * 9),
    complexity: score(new Set(main.flatMap((card) => card.roles)).size * 7 + synergy * 2),
    variance: score(72 - Math.min(48, cardAdvantage * 4 + roleCompressionCount(main) * 5)),
    "commander-dependence": score(commanderDependence),
  };

  return {
    dimensions,
    explanations: (Object.entries(dimensions) as Array<[DeckPersonalityDimension, number]>)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([dimension, value]) => ({
        dimension,
        label: dimension.replace("-", " "),
        detail: `${value}/100 based on visible roles, rules text, and commander dependency signals.`,
      })),
  };
}

export function detectHiddenSynergies(
  requirements: DeckRequirement[],
  ownership: OwnershipMatch[] = [],
): HiddenSynergyCluster[] {
  const ownedNames = new Set(ownership.filter((match) => match.ownedQuantity > 0).map((match) => normalizeCardKey(match.requirement.name)));
  const clusters: HiddenSynergyCluster[] = [];
  const sacrificeCards = relationshipCards(requirements, ["sacrifice-outlet"]);
  const tokenCards = relationshipCards(requirements, ["token-generation"]);
  const deathPayoffs = requirements.filter((card) => text(card).includes("dies") || text(card).includes("whenever") && text(card).includes("creature"));
  if (sacrificeCards.length && (tokenCards.length || deathPayoffs.length)) {
    clusters.push({
      id: "sacrifice-token-payoff",
      title: "Hidden Synergy: sacrifice fuel and payoffs",
      summary: "Token production and sacrifice outlets can convert disposable bodies into repeatable value.",
      cards: [...sacrificeCards, ...tokenCards, ...deathPayoffs].slice(0, 6).map((card) => ({
        name: card.name,
        role: card.roles[0] ?? "synergy",
        owned: ownedNames.has(normalizeCardKey(card.name)),
      })),
      resources: ["creatures", "tokens"],
      payoffs: ["death triggers", "sacrifice value"],
      confidence: sacrificeCards.length >= 2 ? "high" : "medium",
    });
  }

  const artifactCards = requirements.filter((card) => text(card).includes("artifact") || card.roles.includes("mana-fixing"));
  const payoffCards = requirements.filter((card) => text(card).includes("treasure") || text(card).includes("artifact"));
  if (artifactCards.length >= 3 && payoffCards.length >= 2) {
    clusters.push({
      id: "artifact-resource-payoff",
      title: "Hidden Synergy: artifact resources",
      summary: "Mana rocks, Treasures, and artifact-count cards create a resource layer that can support alternate engines.",
      cards: [...artifactCards, ...payoffCards].slice(0, 6).map((card) => ({
        name: card.name,
        role: card.roles[0] ?? "synergy",
        owned: ownedNames.has(normalizeCardKey(card.name)),
      })),
      resources: ["artifacts", "treasure", "mana"],
      payoffs: ["artifact-count scaling", "resource conversion"],
      confidence: "medium",
    });
  }

  const graveyard = relationshipCards(requirements, ["graveyard-interaction", "recursion"]);
  if (graveyard.length >= 3) {
    clusters.push({
      id: "graveyard-second-hand",
      title: "Hidden Synergy: graveyard as a second hand",
      summary: "Self-mill, recursion, and reusable permanents suggest a grind plan that survives removal.",
      cards: graveyard.slice(0, 6).map((card) => ({
        name: card.name,
        role: card.roles[0] ?? "recursion",
        owned: ownedNames.has(normalizeCardKey(card.name)),
      })),
      resources: ["graveyard", "permanents"],
      payoffs: ["recursion", "card advantage"],
      confidence: "high",
    });
  }

  return clusters.slice(0, 3);
}

export function detectRoleCompression(
  requirements: DeckRequirement[],
  ownership: OwnershipMatch[] = [],
): RoleCompressionInsight[] {
  const ownedNames = new Set(ownership.filter((match) => match.ownedQuantity > 0).map((match) => normalizeCardKey(match.requirement.name)));
  return requirements
    .filter((card) => card.board === "main" && new Set(card.roles.filter((role) => role !== "synergy")).size >= 2)
    .map((card): RoleCompressionInsight => {
      const roles = [...new Set(card.roles.filter((role) => role !== "synergy"))].slice(0, 4);
      return {
        cardName: card.name,
        roles,
        explanation: `${card.name} covers ${roles.map((role) => role.replace("-", " ")).join(" + ")} and may free a slot elsewhere.`,
        owned: ownedNames.has(normalizeCardKey(card.name)),
      };
    })
    .sort((left, right) => Number(right.owned) - Number(left.owned) || right.roles.length - left.roles.length || left.cardName.localeCompare(right.cardName))
    .slice(0, 5);
}

export function detectStrategyOverload(
  requirements: DeckRequirement[],
  strategy: CommanderStrategyProfile | null = null,
): StrategyOverloadInsight {
  const themes = new Map<string, number>();
  for (const card of requirements) {
    for (const role of classifyCardRoles(card)) {
      if (role === "land" || role === "mana-fixing") continue;
      themes.set(role, (themes.get(role) ?? 0) + card.requiredQuantity);
    }
  }
  const sorted = [...themes.entries()].sort((left, right) => right[1] - left[1]);
  const supported = sorted.filter(([, count]) => count >= 4).map(([role]) => role.replace("-", " ")).slice(0, 5);
  const overloaded = supported.length >= 4 && Boolean(strategy);
  return {
    themes: supported,
    overloaded,
    recommendation: overloaded
      ? `This build is supporting ${supported.join(", ")}. Review whether the weakest package should be trimmed or strengthened.`
      : "The current role spread does not show major strategy overload.",
  };
}

function buildBrewProposals({
  requirements,
  collection,
  formatId,
  commander,
  constraints,
  ownership,
  currentHealth,
  lockedCardIds = new Set(),
  mustIncludeCardIds = new Set(),
}: BrewContext & {
  constraints: BrewConstraint[];
  ownership: OwnershipMatch[];
  currentHealth: number | null;
}): BrewStructuredProposal[] {
  const format = getFormatProfile(formatId);
  const fallbackConstraints: BrewConstraint[] = [{
    key: "collection-first",
    label: "Use more owned cards",
    detail: "Review owned substitutions and missing-card gaps.",
    confidence: "medium",
  }];
  const activeConstraints: BrewConstraint[] = constraints.length ? constraints : fallbackConstraints;
  const proposals: BrewStructuredProposal[] = [];
  const missing = ownership.filter((match) => match.missingQuantity > 0);
  const cutPool = requirements
    .filter((card) => card.board === "main")
    .filter((card) => !card.roles.includes("land"))
    .filter((card) => !lockedCardIds.has(card.id) && !mustIncludeCardIds.has(card.id))
    .sort((left, right) => (left.importance ?? 1) - (right.importance ?? 1) || left.name.localeCompare(right.name));

  for (const constraint of activeConstraints.slice(0, 3)) {
    const targetMissing = chooseMissingForConstraint(missing, constraint.key) ?? missing[0] ?? null;
    const substitution = targetMissing
      ? recommendOwnedSubstitutions(targetMissing, collection, format, commander)[0] ?? null
      : null;
    const add = substitution
      ? {
        name: substitution.ownedCard.name,
        quantity: 1,
        reason: `${substitution.ownedCard.name} is owned and advances ${constraint.label.toLowerCase()}.`,
        ownedQuantity: substitution.ownedCard.quantityOwned,
        additionalCost: 0,
      }
      : targetMissing
        ? {
          name: targetMissing.requirement.name,
          quantity: Math.max(1, targetMissing.missingQuantity),
          reason: `${targetMissing.requirement.name} is a missing ${constraint.label.toLowerCase()} piece to review.`,
          ownedQuantity: targetMissing.ownedQuantity,
          additionalCost: targetMissing.estimatedMissingValue,
        }
        : null;
    const cut = cutPool.shift();
    const mutation: DeckChangeProposal = {
      id: `brew:${constraint.key}:${targetMissing ? normalizeCardKey(targetMissing.requirement.name) : "review"}`,
      status: "proposed",
      removes: cut ? [{ name: cut.name, quantity: 1, reason: `Candidate cut while testing ${constraint.label.toLowerCase()}.` }] : [],
      adds: add ? [add] : [],
      projectedHealthDelta: null,
      additionalCost: add?.additionalCost ?? null,
      explanation: constraint.detail,
    };
    const applied = add ? applyDeckChangeProposal(requirements, mutation, format, { commander }) : null;
    const nextHealth = applied?.applied ? analyzeDeckHealth(applied.requirements, format).overall : currentHealth;
    proposals.push({
      id: mutation.id,
      title: constraint.label,
      mode: constraint.key === "more-unusual" ? "surprise" : "brew",
      intentChanges: [constraint],
      strategyChanges: constraint.key === "add-sacrifice-subtheme" ? ["Explore sacrifice support as a secondary package."] : [],
      suggestedAdds: mutation.adds,
      suggestedCuts: mutation.removes,
      constraints: [constraint],
      explanation: `${constraint.detail} Deck Architect proposes this as a reviewable change, then validates the resulting list before it can be saved.`,
      validation: applied?.validation ?? validateDeckRequirements(requirements, format, { commander }),
      projectedHealthDelta: currentHealth !== null && nextHealth !== null ? { from: currentHealth, to: nextHealth } : null,
      additionalCost: mutation.additionalCost,
    });
  }

  return proposals;
}

export function discoverCollectionOpportunities(
  collection: CollectionGraphCard[],
  formatId: DeckArchitectFormatId,
): BuildOpportunity[] {
  const support = new Map<string, CollectionGraphCard[]>();
  for (const card of collection) {
    const roles = classifyCardRoles(card);
    const taxonomyBuckets = [
      roles.includes("sacrifice-outlet") ? "Sacrifice Value" : null,
      roles.includes("graveyard-interaction") || roles.includes("recursion") ? "Graveyard Engine" : null,
      roles.includes("token-generation") ? "Token Conversion" : null,
      roles.includes("artifact-interaction") || text(card).includes("artifact") ? "Artifact Resource Loop" : null,
      roles.includes("countermagic") || roles.includes("interaction") ? "Interactive Tempo" : null,
    ].filter((value): value is string => Boolean(value));
    for (const bucket of taxonomyBuckets) {
      support.set(bucket, [...(support.get(bucket) ?? []), card]);
    }
  }

  return [...support.entries()]
    .filter(([, cards]) => cards.length >= 2)
    .map(([name, cards]) => {
      const requirements = cards.slice(0, Math.min(10, cards.length)).map((card) => ({
        id: `opportunity:${normalizeCardKey(name)}:${card.inventoryId}`,
        name: card.name,
        requiredQuantity: 1,
        board: "main" as const,
        roles: classifyCardRoles(card),
        estimatedPrice: card.marketPrice ?? null,
        typeLine: card.typeLine,
        oracleText: card.oracleText,
        colorIdentity: card.colorIdentity,
      }));
      const format = getFormatProfile(formatId);
      const buildability = calculateBuildabilityScore(compareRequirementsToCollection(requirements, collection, format));
      return {
        id: `collection-idea:${normalizeCardKey(name)}`,
        name,
        formatId,
        buildability,
        category: cards.length >= 8 ? "nearly-complete" : "worth-considering",
        confidence: cards.length >= 6 ? "high" : "medium",
        signals: [{
          label: "Owned support",
          impact: "positive",
          detail: `${cards.length} owned cards support this direction.`,
        }],
        source: "collection-calculation",
        disclosure: "Generated from owned cards, role classification, and deterministic synergy buckets.",
      } satisfies BuildOpportunity;
    })
    .sort((left, right) => right.buildability.score - left.buildability.score || left.name.localeCompare(right.name))
    .slice(0, 5);
}

function chooseMissingForConstraint(missing: OwnershipMatch[], key: BrewConstraint["key"]) {
  const roleTargets: Partial<Record<BrewConstraint["key"], DeckArchitectRole[]>> = {
    "more-aggressive": ["threat", "finisher", "burn"],
    "more-interaction": ["interaction", "removal", "countermagic"],
    "more-resilient": ["recursion", "protection", "card-advantage"],
    "reduce-variance": ["card-advantage", "card-draw", "tutor"],
    "budget-cap": ["ramp", "interaction", "card-advantage"],
    "less-commander-dependent": ["card-advantage", "interaction", "threat"],
    "add-sacrifice-subtheme": ["sacrifice-outlet", "token-generation", "recursion"],
  };
  const roles = roleTargets[key] ?? [];
  return missing.find((match) => match.requirement.roles.some((role) => roles.includes(role))) ?? null;
}

function relationshipCards(requirements: DeckRequirement[], roles: DeckArchitectRole[]) {
  return requirements.filter((card) => roles.some((role) => card.roles.includes(role)));
}

function text(card: Pick<DeckRequirement | CollectionGraphCard, "name" | "typeLine" | "oracleText">) {
  return `${card.name} ${card.typeLine ?? ""} ${card.oracleText ?? ""}`.toLowerCase();
}

function roleCompressionCount(cards: DeckRequirement[]) {
  return cards.filter((card) => new Set(card.roles.filter((role) => role !== "synergy")).size >= 2).length;
}

function score(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
