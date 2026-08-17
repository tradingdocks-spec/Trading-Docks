import type { BuildabilityScore, OwnershipMatch } from "./types.ts";

export function calculateBuildabilityScore(matches: OwnershipMatch[]): BuildabilityScore {
  const requiredCards = matches.reduce((sum, match) => sum + match.requirement.requiredQuantity, 0);
  const ownedCards = matches.reduce(
    (sum, match) => sum + Math.min(match.ownedQuantity, match.requirement.requiredQuantity),
    0,
  );
  const missingCards = Math.max(0, requiredCards - ownedCards);
  const missingUniqueCards = matches.filter((match) => match.missingQuantity > 0).length;
  const commanderMatch = matches.find((match) => match.requirement.isCommander);
  const commanderOwned = commanderMatch ? commanderMatch.missingQuantity === 0 : null;
  const missingMatches = matches.filter((match) => match.missingQuantity > 0);
  const knownCompletionCosts = missingMatches
    .map((match) => match.estimatedMissingValue)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const estimatedCompletionCost =
    knownCompletionCosts.length === missingMatches.length
      ? Number(knownCompletionCosts.reduce((sum, value) => sum + value, 0).toFixed(2))
      : null;

  const weightedRequired = matches.reduce(
    (sum, match) => sum + match.requirement.requiredQuantity * (match.requirement.importance ?? 1),
    0,
  );
  const weightedOwned = matches.reduce(
    (sum, match) =>
      sum +
      Math.min(match.ownedQuantity, match.requirement.requiredQuantity) *
        (match.requirement.importance ?? 1),
    0,
  );
  const costPenalty =
    estimatedCompletionCost === null ? 0 : Math.min(18, Math.log10(estimatedCompletionCost + 1) * 6);
  const commanderPenalty = commanderOwned === false ? 12 : 0;
  const rawScore = weightedRequired > 0 ? (weightedOwned / weightedRequired) * 100 : 0;
  const score = Math.max(0, Math.min(100, Math.round(rawScore - costPenalty - commanderPenalty)));

  return {
    score,
    requiredCards,
    ownedCards,
    missingCards,
    missingUniqueCards,
    estimatedCompletionCost,
    commanderOwned,
    factors: [
      {
        label: "Owned coverage",
        value: `${ownedCards} / ${requiredCards} cards covered`,
        impact: missingCards ? "neutral" : "positive",
      },
      {
        label: "Missing cards",
        value: `${missingUniqueCards} unique gaps`,
        impact: missingUniqueCards ? "negative" : "positive",
      },
      {
        label: "Completion cost",
        value: estimatedCompletionCost === null ? "Pricing unavailable" : `$${estimatedCompletionCost.toFixed(2)}`,
        impact: estimatedCompletionCost && estimatedCompletionCost > 50 ? "negative" : "neutral",
      },
      {
        label: "Commander",
        value: commanderOwned === null ? "Not required" : commanderOwned ? "Owned" : "Missing",
        impact: commanderOwned === false ? "negative" : "positive",
      },
    ],
  };
}
