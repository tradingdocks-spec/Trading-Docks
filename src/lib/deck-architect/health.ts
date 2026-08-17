import type { DeckHealthReport, DeckRequirement, FormatProfile } from "./types.ts";

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function analyzeDeckHealth(
  requirements: DeckRequirement[],
  format: FormatProfile,
): DeckHealthReport {
  const main = requirements.filter((card) => card.board === "main");
  const mainCount = main.reduce((sum, card) => sum + card.requiredQuantity, 0);
  const landCount = main
    .filter((card) => card.roles.includes("land") || card.typeLine?.toLowerCase().includes("land"))
    .reduce((sum, card) => sum + card.requiredQuantity, 0);
  const interactionCount = main
    .filter((card) => card.roles.some((role) => role === "interaction" || role === "removal" || role === "countermagic"))
    .reduce((sum, card) => sum + card.requiredQuantity, 0);
  const advantageCount = main
    .filter((card) => card.roles.includes("card-advantage"))
    .reduce((sum, card) => sum + card.requiredQuantity, 0);
  const synergyCount = main
    .filter((card) => card.roles.some((role) => role === "synergy" || role === "combo-piece"))
    .reduce((sum, card) => sum + card.requiredQuantity, 0);
  const illegalCount = requirements.filter((card) => card.legalityStatus === "banned" || card.legalityStatus === "not_legal").length;

  const desiredLand = format.commanderRequired ? 36 : 24;
  const desiredInteraction = format.commanderRequired ? 10 : 8;
  const desiredAdvantage = format.commanderRequired ? 9 : 5;
  const deckSizeTarget = format.exactDeckSize ?? format.minimumMainDeckSize ?? mainCount;

  const categories = {
    mana: clampScore(100 - Math.abs(desiredLand - landCount) * 5),
    consistency: clampScore((mainCount / Math.max(1, deckSizeTarget)) * 100),
    interaction: clampScore((interactionCount / desiredInteraction) * 100),
    "card-advantage": clampScore((advantageCount / desiredAdvantage) * 100),
    synergy: clampScore(Math.min(100, 62 + synergyCount * 4)),
    "format-legality": illegalCount ? clampScore(100 - illegalCount * 20) : 100,
    overall: 0,
  };
  categories.overall = clampScore(
    (categories.mana +
      categories.consistency +
      categories.interaction +
      categories["card-advantage"] +
      categories.synergy +
      categories["format-legality"]) /
      6,
  );

  const warnings: string[] = [];
  const strengths: string[] = [];
  if (categories.mana < 75) warnings.push("Mana base needs review before this build is reliable.");
  else strengths.push("Mana count is within the expected range for this format.");
  if (categories.interaction < 75) warnings.push("Interaction density is below the target for this format.");
  else strengths.push("Interaction density is healthy.");
  if (categories["format-legality"] < 100) warnings.push("Legality provider flagged at least one card as unavailable for this format.");
  if (categories.synergy >= 82) strengths.push("The card pool has a meaningful synergy package.");

  return { overall: categories.overall, categories, strengths, warnings };
}
