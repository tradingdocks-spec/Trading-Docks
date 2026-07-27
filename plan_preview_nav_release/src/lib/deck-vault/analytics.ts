import type {
  DeckCard,
  ManaColor,
} from "./types";

export function deckAnalytics(cards: DeckCard[]) {
  const expanded = cards.flatMap((card) =>
    Array.from({ length: card.quantity }, () => card),
  );

  const nonLands = expanded.filter(
    (card) => !card.typeLine.toLowerCase().includes("land"),
  );

  const manaCurve = Array.from({ length: 8 }, (_, index) => ({
    label: index === 7 ? "7+" : String(index),
    value: nonLands.filter((card) =>
      index === 7
        ? card.manaValue >= 7
        : card.manaValue === index,
    ).length,
  }));

  const types = [
    "Creature",
    "Instant",
    "Sorcery",
    "Artifact",
    "Enchantment",
    "Planeswalker",
    "Land",
  ].map((type) => ({
    label: type,
    value: expanded.filter((card) =>
      card.typeLine.toLowerCase().includes(type.toLowerCase()),
    ).length,
  }));

  const colors: ManaColor[] = ["W", "U", "B", "R", "G", "C"];
  const colorDemand = colors.map((color) => ({
    color,
    value: expanded.reduce(
      (sum, card) =>
        sum +
        (card.colors.includes(color)
          ? Math.max(1, card.colors.filter((entry) => entry === color).length)
          : 0),
      0,
    ),
  }));

  const categories = [
    "Ramp",
    "Card Draw",
    "Removal",
    "Board Wipe",
    "Protection",
    "Tutor",
    "Proliferate",
  ].map((category) => ({
    label: category,
    value: expanded.filter(
      (card) => card.category === category,
    ).length,
  }));

  const totalMana = nonLands.reduce(
    (sum, card) => sum + card.manaValue,
    0,
  );

  return {
    manaCurve,
    types,
    colorDemand,
    categories,
    averageManaValue:
      nonLands.length > 0
        ? totalMana / nonLands.length
        : 0,
    totalValue: expanded.reduce(
      (sum, card) => sum + card.price,
      0,
    ),
    ownedCount: expanded.filter((card) => card.owned).length,
    missingCount: expanded.filter((card) => !card.owned).length,
  };
}
