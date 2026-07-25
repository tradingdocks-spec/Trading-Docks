import type { DeckCard } from "./types";

export type CommanderBracket =
  | 1
  | 2
  | 3
  | 4
  | 5;

export type BracketReview = {
  bracket: CommanderBracket;
  name: string;
  gameChangerCount: number;
  gameChangers: string[];
  reasons: string[];
  disclosure: string;
};

export function evaluateCommanderBracket(
  cards: DeckCard[],
): BracketReview {
  const expanded = cards.flatMap((card) =>
    Array.from(
      { length: Math.max(1, card.quantity) },
      () => card,
    ),
  );

  const gameChangers = expanded.filter(
    (card) => card.gameChanger,
  );
  const gameChangerNames = Array.from(
    new Set(gameChangers.map((card) => card.name)),
  );

  const fastMana = expanded.filter((card) =>
    [
      "Mana Vault",
      "Chrome Mox",
      "Mox Diamond",
      "Mox Opal",
      "Lotus Petal",
      "Grim Monolith",
      "Jeweled Lotus",
      "Mana Crypt",
    ].includes(card.name),
  ).length;

  const compactWins = expanded.filter((card) =>
    [
      "Thassa's Oracle",
      "Demonic Consultation",
      "Tainted Pact",
      "Underworld Breach",
      "Food Chain",
      "Ad Nauseam",
    ].includes(card.name),
  ).length;

  const tutors = expanded.filter(
    (card) =>
      card.category === "Tutor" ||
      /Tutor|Search your library/i.test(card.name),
  ).length;

  const averageManaValue = averageNonlandManaValue(
    expanded,
  );

  let bracket: CommanderBracket = 2;
  const reasons: string[] = [];

  if (
    compactWins >= 2 &&
    (fastMana >= 2 || tutors >= 4)
  ) {
    bracket = 5;
    reasons.push(
      "The deck contains compact win packages supported by fast mana or dense tutoring.",
    );
  } else if (
    gameChangers.length >= 4 ||
    fastMana >= 3 ||
    compactWins >= 2
  ) {
    bracket = 4;
    reasons.push(
      "The deck has an optimized concentration of Game Changers, fast mana, or compact wins.",
    );
  } else if (
    gameChangers.length > 0 ||
    tutors >= 3 ||
    fastMana >= 1
  ) {
    bracket = 3;
    reasons.push(
      "The deck includes upgrades that materially raise consistency or table impact.",
    );
  } else if (
    averageManaValue > 4.5 ||
    cards.length < 40
  ) {
    bracket = 1;
    reasons.push(
      "The deck appears intentionally unusual, incomplete, or exhibition-oriented.",
    );
  } else {
    reasons.push(
      "The deck appears suitable for a typical socially focused Commander game.",
    );
  }

  if (gameChangers.length) {
    reasons.push(
      `${gameChangers.length} Game Changer${
        gameChangers.length === 1 ? "" : "s"
      } detected.`,
    );
  } else {
    reasons.push("No Game Changers detected.");
  }

  const names = {
    1: "Exhibition",
    2: "Core",
    3: "Upgraded",
    4: "Optimized",
    5: "cEDH",
  } as const;

  return {
    bracket,
    name: names[bracket],
    gameChangerCount: gameChangers.length,
    gameChangers: gameChangerNames,
    reasons,
    disclosure:
      bracket >= 4
        ? "Discuss speed, compact wins, and high-impact cards before the game."
        : gameChangers.length
          ? "Disclose the listed Game Changers during the pregame conversation."
          : "No special Game Changer disclosure detected.",
  };
}

function averageNonlandManaValue(cards: DeckCard[]) {
  const nonlands = cards.filter(
    (card) =>
      !card.typeLine.toLowerCase().includes("land"),
  );

  if (!nonlands.length) return 0;

  return (
    nonlands.reduce(
      (sum, card) => sum + card.manaValue,
      0,
    ) / nonlands.length
  );
}
