import { isBasicLand, maximumCopiesForCard } from "./formats.ts";
import type {
  CollectionGraphCard,
  DeckArchitectFormatId,
  DeckRequirement,
  DeckValidationIssue,
  DeckValidationResult,
  FormatProfile,
} from "./types.ts";

const LEGAL_STATUSES = new Set(["legal", "not_legal", "banned", "restricted"]);

export function cardLegalityForFormat(
  card: {
    legalities?: Record<string, string>;
    legalityStatus?: "legal" | "banned" | "not_legal" | "restricted" | "unknown";
    name: string;
  },
  formatId: DeckArchitectFormatId,
): "legal" | "banned" | "not_legal" | "restricted" | "unknown" {
  if (card.legalityStatus) return card.legalityStatus;
  const raw = card.legalities?.[formatId];
  if (!raw) return "unknown";
  const normalized = raw.toLowerCase();
  return LEGAL_STATUSES.has(normalized)
    ? normalized as "legal" | "banned" | "not_legal" | "restricted"
    : "unknown";
}

export function validateDeckRequirements(
  requirements: DeckRequirement[],
  format: FormatProfile,
  options: {
    commander?: CollectionGraphCard | null;
    lockedCardIds?: Set<string>;
    mustIncludeCardIds?: Set<string>;
  } = {},
): DeckValidationResult {
  const issues: DeckValidationIssue[] = [];
  const commanderCards = requirements.filter((card) => card.board === "commander" || card.isCommander);
  const mainCards = requirements.filter((card) => card.board === "main");
  const sideboardCards = requirements.filter((card) => card.board === "sideboard");
  const totalMain = mainCards.reduce((sum, card) => sum + card.requiredQuantity, 0);
  const totalDeck = requirements
    .filter((card) => card.board === "commander" || card.board === "main")
    .reduce((sum, card) => sum + card.requiredQuantity, 0);

  if (format.commanderRequired && commanderCards.length !== (format.commanderCount ?? 1)) {
    issues.push({
      code: "commander-count",
      severity: "error",
      message: `${format.name} requires exactly ${format.commanderCount ?? 1} commander.`,
    });
  }
  if (format.exactDeckSize && totalDeck !== format.exactDeckSize) {
    issues.push({
      code: "deck-size",
      severity: "error",
      message: `${format.name} requires exactly ${format.exactDeckSize} cards across command and main deck.`,
    });
  }
  if (format.minimumMainDeckSize && totalMain < format.minimumMainDeckSize) {
    issues.push({
      code: "main-deck-size",
      severity: "error",
      message: `${format.name} requires at least ${format.minimumMainDeckSize} main-deck cards.`,
    });
  }
  if (!format.sideboardAllowed && sideboardCards.length > 0) {
    issues.push({
      code: "sideboard-not-allowed",
      severity: "error",
      message: `${format.name} does not allow sideboard cards in this planner.`,
    });
  }
  const sideboardCount = sideboardCards.reduce((sum, card) => sum + card.requiredQuantity, 0);
  if (format.maximumSideboardSize && sideboardCount > format.maximumSideboardSize) {
    issues.push({
      code: "sideboard-size",
      severity: "error",
      message: `${format.name} sideboards cannot exceed ${format.maximumSideboardSize} cards.`,
    });
  }

  const quantityByName = new Map<string, number>();
  for (const card of requirements) {
    if (card.requiredQuantity <= 0) {
      issues.push({
        code: "invalid-quantity",
        severity: "error",
        cardName: card.name,
        message: `${card.name} has an invalid quantity.`,
      });
    }
    const key = card.name.trim().toLowerCase();
    quantityByName.set(key, (quantityByName.get(key) ?? 0) + card.requiredQuantity);
    const status = cardLegalityForFormat(card, format.id);
    if (status === "banned" || status === "not_legal") {
      issues.push({
        code: "illegal-card",
        severity: "error",
        cardName: card.name,
        message: `${card.name} is ${status.replace("_", " ")} in ${format.name}.`,
      });
    }
  }

  for (const [name, quantity] of quantityByName) {
    const maxCopies = maximumCopiesForCard(format, name);
    if (quantity > maxCopies) {
      issues.push({
        code: "copy-limit",
        severity: "error",
        cardName: name,
        message: `${name} exceeds the ${format.name} copy limit.`,
      });
    }
  }

  const restrictedCounts = new Map<string, number>();
  for (const card of requirements) {
    if (cardLegalityForFormat(card, format.id) !== "restricted" || isBasicLand(card.name)) continue;
    const key = card.name.trim().toLowerCase();
    restrictedCounts.set(key, (restrictedCounts.get(key) ?? 0) + card.requiredQuantity);
  }
  for (const [name, quantity] of restrictedCounts) {
    if (quantity > 1) {
      issues.push({
        code: "restricted-limit",
        severity: "error",
        cardName: name,
        message: `${name} is restricted and cannot exceed one copy.`,
      });
    }
  }

  if (format.enforceColorIdentity && options.commander) {
    const allowed = new Set(options.commander.colorIdentity ?? []);
    for (const card of requirements) {
      const colors = card.colorIdentity ?? [];
      if (colors.some((color) => !allowed.has(color))) {
        issues.push({
          code: "color-identity",
          severity: "error",
          cardName: card.name,
          message: `${card.name} is outside ${options.commander.name}'s color identity.`,
        });
      }
    }
  }

  for (const lockedId of options.lockedCardIds ?? []) {
    if (!requirements.some((card) => card.id === lockedId)) {
      issues.push({
        code: "locked-card-removed",
        severity: "error",
        message: "A locked card was removed from the proposal.",
      });
    }
  }
  for (const mustIncludeId of options.mustIncludeCardIds ?? []) {
    if (!requirements.some((card) => card.id === mustIncludeId)) {
      issues.push({
        code: "must-include-card-missing",
        severity: "error",
        message: "A must-include card is missing from the proposal.",
      });
    }
  }

  return { valid: !issues.some((issue) => issue.severity === "error"), issues };
}
