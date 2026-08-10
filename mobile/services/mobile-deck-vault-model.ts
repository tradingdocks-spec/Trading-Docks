import type { DeckCard, DeckRecord, ManaColor } from '../../src/lib/deck-vault/types';

export type { DeckCard, DeckRecord, ManaColor } from '../../src/lib/deck-vault/types';

export type MobileDeckSummary = {
  deckCount: number;
  favoriteCount: number;
  totalCards: number;
  knownValue: number | null;
  recentDecks: DeckRecord[];
};

export type MobileDeckAnalytics = {
  manaCurve: Array<{ label: string; value: number }>;
  cardTypes: Array<{ label: string; value: number }>;
  averageManaValue: number;
  knownValue: number | null;
  missingCards: number;
};

export function summarizeMobileDeckVault(decks: DeckRecord[]): MobileDeckSummary {
  const pricedDecks = decks.filter((deck) => Number.isFinite(deck.marketValue) && deck.marketValue > 0);
  return {
    deckCount: decks.length,
    favoriteCount: decks.filter((deck) => deck.status === 'Complete').length,
    totalCards: decks.reduce((sum, deck) => sum + Math.max(0, deck.cardCount), 0),
    knownValue: pricedDecks.length
      ? pricedDecks.reduce((sum, deck) => sum + deck.marketValue, 0)
      : null,
    recentDecks: decks.slice(0, 6),
  };
}

export function analyzeMobileDeck(deck: DeckRecord): MobileDeckAnalytics {
  const expanded = deck.cards.flatMap((card) =>
    Array.from({ length: Math.max(0, card.quantity) }, () => card),
  );
  const nonLands = expanded.filter((card) => !card.typeLine.toLowerCase().includes('land'));
  const totalMana = nonLands.reduce((sum, card) => sum + card.manaValue, 0);
  const pricedCards = expanded.filter((card) => Number.isFinite(card.price) && card.price > 0);

  return {
    manaCurve: Array.from({ length: 8 }, (_, index) => ({
      label: index === 7 ? '7+' : String(index),
      value: nonLands.filter((card) => (index === 7 ? card.manaValue >= 7 : card.manaValue === index)).length,
    })),
    cardTypes: ['Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Land', 'Other'].map((label) => ({
      label,
      value: label === 'Other'
        ? expanded.filter((card) => !knownDeckType(card)).length
        : expanded.filter((card) => card.typeLine.toLowerCase().includes(label.toLowerCase())).length,
    })),
    averageManaValue: nonLands.length ? totalMana / nonLands.length : 0,
    knownValue: pricedCards.length ? pricedCards.reduce((sum, card) => sum + card.price * card.quantity, 0) : null,
    missingCards: expanded.filter((card) => !card.owned).length,
  };
}

export function colorIdentityLabel(colors: ManaColor[]) {
  return colors.length ? colors.join('') : 'C';
}

export function formatDeckValue(value: number | null) {
  if (value === null) return 'Value unavailable';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function knownDeckType(card: DeckCard) {
  const typeLine = card.typeLine.toLowerCase();
  return ['creature', 'instant', 'sorcery', 'artifact', 'enchantment', 'planeswalker', 'land']
    .some((type) => typeLine.includes(type));
}
