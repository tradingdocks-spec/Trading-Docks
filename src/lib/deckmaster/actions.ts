import {
  getFormatProfile,
  isCommanderEligible,
  validateDeckRequirements,
  type CollectionGraphCard,
  type DeckValidationIssue as RulesIssue,
} from "../deck-architect/index.ts";
import {
  deckCardToRequirement,
  deckFormatToArchitectFormat,
} from "../deck-suite/domain.ts";
import type { DeckCard, DeckRecord } from "../deck-vault/types.ts";

export type DeckmasterBuildRequest = {
  format: DeckRecord["format"];
  commanderOrFocalCard?: string;
  archetype?: string;
  budget?: number;
  ownedCardPreference: "prefer" | "only" | "any";
  powerTarget?: number;
  instructions?: string;
};

export type DeckmasterCardChange = { card: DeckCard; quantity: number; reason?: string };
export type DeckmasterSwap = { remove: DeckmasterCardChange; add: DeckmasterCardChange; reason?: string };

export type DeckChangeProposal = {
  id: string;
  deckId: string;
  additions: DeckmasterCardChange[];
  removals: DeckmasterCardChange[];
  swaps: DeckmasterSwap[];
  explanation: string;
  legality: {
    valid: boolean;
    canApply: boolean;
    issues: RulesIssue[];
    introducedIssues: RulesIssue[];
  };
  pricingImpact: number;
  ownershipImpact: { owned: number; missing: number };
  createdAt: string;
};

export type DeckmasterContext = {
  deckId: string;
  deckName: string;
  format: DeckRecord["format"];
  commander?: string;
  cards: DeckCard[];
  collection: Array<{ name: string; quantity: number }>;
  isEmpty: boolean;
};

export type DeckmasterActionLayer = {
  inspectDeck(deck: DeckRecord): DeckmasterContext;
  inspectCollection(context: DeckmasterContext, collection: DeckmasterContext["collection"]): DeckmasterContext;
  searchCards(query: string, context: DeckmasterContext): Promise<DeckCard[]>;
  checkLegality(deck: DeckRecord, cards: DeckCard[]): ReturnType<typeof checkLegality>;
  calculateDeckPrice(cards: DeckCard[]): number;
  compareDeckToCollection(cards: DeckCard[], collection: DeckmasterContext["collection"]): ReturnType<typeof compareDeckToCollection>;
  recommendCards(request: string, context: DeckmasterContext): Promise<DeckChangeProposal>;
  findReplacements(request: string, context: DeckmasterContext): Promise<DeckChangeProposal>;
  addCards(deck: DeckRecord, additions: DeckmasterCardChange[], explanation: string): DeckChangeProposal;
  removeCards(deck: DeckRecord, removals: DeckmasterCardChange[], explanation: string): DeckChangeProposal;
  swapCards(deck: DeckRecord, swaps: DeckmasterSwap[], explanation: string): DeckChangeProposal;
  buildDeck(request: DeckmasterBuildRequest, context: DeckmasterContext): Promise<DeckChangeProposal>;
};

export function addCards(deck: DeckRecord, additions: DeckmasterCardChange[], explanation: string) {
  return createDeckChangeProposal(deck, { additions, removals: [], swaps: [], explanation });
}

export function removeCards(deck: DeckRecord, removals: DeckmasterCardChange[], explanation: string) {
  return createDeckChangeProposal(deck, { additions: [], removals, swaps: [], explanation });
}

export function swapCards(deck: DeckRecord, swaps: DeckmasterSwap[], explanation: string) {
  return createDeckChangeProposal(deck, { additions: [], removals: [], swaps, explanation });
}

export function inspectDeck(deck: DeckRecord): DeckmasterContext {
  return {
    deckId: deck.id,
    deckName: deck.name,
    format: deck.format,
    commander: deck.commander,
    cards: deck.cards.map((card) => ({ ...card })),
    collection: [],
    isEmpty: deck.cards.length === 0,
  };
}

export function inspectCollection(
  context: DeckmasterContext,
  collection: DeckmasterContext["collection"],
): DeckmasterContext {
  return { ...context, collection: collection.map((item) => ({ ...item })) };
}

export function calculateDeckPrice(cards: DeckCard[]) {
  return cards.reduce((total, card) => total + card.price * card.quantity, 0);
}

export function compareDeckToCollection(cards: DeckCard[], collection: DeckmasterContext["collection"]) {
  const owned = new Map(collection.map((item) => [item.name.trim().toLowerCase(), item.quantity]));
  return cards.map((card) => ({
    card,
    owned: Math.min(card.quantity, owned.get(card.name.trim().toLowerCase()) ?? card.ownedQuantity ?? 0),
    missing: Math.max(0, card.quantity - (owned.get(card.name.trim().toLowerCase()) ?? card.ownedQuantity ?? 0)),
  }));
}

export function filterOwnedCards<T extends { name: string }>(cards: T[], collection: DeckmasterContext["collection"]) {
  const owned = new Set(collection.filter((item) => item.quantity > 0).map((item) => item.name.trim().toLowerCase()));
  return cards.filter((card) => owned.has(card.name.trim().toLowerCase()));
}

export function createDeckChangeProposal(
  deck: DeckRecord,
  change: Pick<DeckChangeProposal, "additions" | "removals" | "swaps" | "explanation">,
): DeckChangeProposal {
  const nextCards = applyChangesUnchecked(deck.cards, change);
  const legality = checkLegality(deck, nextCards);
  const existingErrors = new Set(checkLegality(deck, deck.cards).issues.filter(isError).map(issueKey));
  const introducedIssues = legality.issues.filter(isError).filter((issue) => !existingErrors.has(issueKey(issue)));
  const beforeOwnership = summarizeOwnership(deck.cards);
  const afterOwnership = summarizeOwnership(nextCards);
  return {
    ...change,
    id: `deckmaster-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    deckId: deck.id,
    legality: {
      ...legality,
      canApply: introducedIssues.length === 0,
      introducedIssues,
    },
    pricingImpact: roundCurrency(calculateDeckPrice(nextCards) - calculateDeckPrice(deck.cards)),
    ownershipImpact: {
      owned: afterOwnership.owned - beforeOwnership.owned,
      missing: afterOwnership.missing - beforeOwnership.missing,
    },
    createdAt: new Date().toISOString(),
  };
}

export function checkLegality(deck: DeckRecord, cards: DeckCard[]) {
  const format = getFormatProfile(deckFormatToArchitectFormat(deck.format));
  const requirements = cards.map(deckCardToRequirement);
  const commanderCard = cards.find((card) => card.board === "commander" || card.category === "Commander");
  const commander: CollectionGraphCard | null = commanderCard
    ? {
        inventoryId: commanderCard.id,
        name: commanderCard.name,
        quantityOwned: commanderCard.ownedQuantity ?? 0,
        typeLine: commanderCard.typeLine,
        colorIdentity: commanderCard.colors,
      }
    : null;
  const result = validateDeckRequirements(requirements, format, { commander });
  if (commanderCard && format.commanderRequired && !isCommanderEligible(commanderCard)) {
    result.issues.push({
      code: "commander-eligibility",
      severity: "error",
      cardName: commanderCard.name,
      message: `${commanderCard.name} is not eligible to be a commander.`,
    });
  }
  return { valid: !result.issues.some((issue) => issue.severity === "error"), issues: result.issues };
}

export function applyDeckChangeProposal(deck: DeckRecord, proposal: DeckChangeProposal): DeckRecord {
  if (proposal.deckId !== deck.id) throw new Error("This proposal belongs to a different deck.");
  const nextCards = applyChangesUnchecked(deck.cards, proposal);
  const before = checkLegality(deck, deck.cards);
  const after = checkLegality(deck, nextCards);
  const existingErrors = new Set(before.issues.filter(isError).map(issueKey));
  const introduced = after.issues.filter(isError).filter((issue) => !existingErrors.has(issueKey(issue)));
  if (introduced.length) throw new Error(introduced.map((issue) => issue.message).join(" "));
  return recalculateDeck({ ...deck, cards: nextCards });
}

function applyChangesUnchecked(
  cards: DeckCard[],
  change: Pick<DeckChangeProposal, "additions" | "removals" | "swaps">,
) {
  let next = cards.map((card) => ({ ...card }));
  const removals = [...change.removals, ...change.swaps.map((swap) => swap.remove)];
  const additions = [...change.additions, ...change.swaps.map((swap) => swap.add)];
  for (const removal of removals) {
    const key = removal.card.name.trim().toLowerCase();
    let remaining = removal.quantity;
    next = next.flatMap((card) => {
      if (remaining <= 0 || card.name.trim().toLowerCase() !== key) return [card];
      const removed = Math.min(remaining, card.quantity);
      remaining -= removed;
      return card.quantity > removed ? [{ ...card, quantity: card.quantity - removed }] : [];
    });
  }
  for (const addition of additions) {
    if (addition.quantity <= 0) continue;
    const board = addition.card.board ?? "main";
    const existing = next.find((card) => card.name.toLowerCase() === addition.card.name.toLowerCase() && (card.board ?? "main") === board);
    if (existing) existing.quantity += addition.quantity;
    else next.push({ ...addition.card, quantity: addition.quantity });
  }
  return next;
}

function recalculateDeck(deck: DeckRecord): DeckRecord {
  const main = deck.cards.filter((card) => card.board !== "commander" && card.category !== "Commander");
  const commanders = deck.cards.filter((card) => card.board === "commander" || card.category === "Commander");
  const owned = main.reduce((sum, card) => sum + Math.min(card.quantity, card.ownedQuantity ?? (card.owned ? card.quantity : 0)), 0);
  return {
    ...deck,
    commander: commanders[0]?.name,
    commanders: commanders.map((card) => card.name),
    cards: deck.cards,
    cardCount: main.reduce((sum, card) => sum + card.quantity, 0) + commanders.length,
    marketValue: calculateDeckPrice(deck.cards),
    ownedCount: main.length ? Math.round((owned / Math.max(1, main.reduce((sum, card) => sum + card.quantity, 0))) * 100) : 0,
    updatedAt: new Date().toISOString(),
  };
}

function summarizeOwnership(cards: DeckCard[]) {
  return cards.reduce((summary, card) => {
    const owned = Math.min(card.quantity, card.ownedQuantity ?? (card.owned ? card.quantity : 0));
    summary.owned += owned;
    summary.missing += card.quantity - owned;
    return summary;
  }, { owned: 0, missing: 0 });
}

function roundCurrency(value: number) { return Math.round(value * 100) / 100; }
function isError(issue: RulesIssue) { return issue.severity === "error"; }
function issueKey(issue: RulesIssue) { return `${issue.code}:${issue.cardName?.toLowerCase() ?? "deck"}`; }
