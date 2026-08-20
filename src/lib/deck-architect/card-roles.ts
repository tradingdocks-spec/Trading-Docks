import type { CollectionGraphCard, DeckArchitectRole, DeckRequirement } from "./types.ts";

type RoleInput = Pick<CollectionGraphCard | DeckRequirement, "name" | "oracleText" | "typeLine" | "manaCost">;
export type RoleSignal = { role: DeckArchitectRole; confidence: "high" | "medium" | "low"; confidenceScore: number; reason: string };

export function classifyCardRoles(card: RoleInput): DeckArchitectRole[] {
  const signals = classifyCardRoleSignals(card);
  const roles = signals
    .filter((signal) => signal.confidenceScore >= 0.55)
    .map((signal) => signal.role);
  return [...new Set<DeckArchitectRole>(roles.length ? roles : ["synergy"])];
}

export function classifyCardRoleSignals(card: RoleInput): RoleSignal[] {
  const typeLine = card.typeLine?.toLowerCase() ?? "";
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  const name = card.name.toLowerCase();
  const haystack = `${name} ${typeLine} ${oracleText}`;
  const signals: RoleSignal[] = [];

  if (typeLine.includes("land")) add(signals, "land", "high", "Land card.");
  const fixing = colorFixingProfile(card);
  if (fixing.confidence) {
    add(signals, "mana-fixing", fixing.confidence, fixing.reason);
    add(signals, "color-fixing", fixing.confidence, "Improves access to required deck colors.");
  }
  if (isLandFixing(card)) add(signals, "land-fixing", "high", "Searches or improves lands.");
  if (isManaRock(card)) add(signals, "mana-rock", "high", "Artifact that produces mana.");
  if (isManaDork(card)) add(signals, "mana-dork", "high", "Creature that produces mana.");
  if (isRitual(card)) add(signals, "ritual", "high", "Temporary burst mana.");
  if (isTreasureGeneration(card)) add(signals, "treasure-generation", isConditionalTreasure(card) ? "low" : "high", isConditionalTreasure(card) ? "Conditionally creates Treasure; not reliable fixing or ramp." : "Creates Treasure mana.");
  if (isCostReduction(card)) add(signals, "cost-reduction", "high", "Reduces spell or typal costs.");
  if (isHighConfidenceRamp(card)) {
    add(signals, "ramp", "high", "Meaningfully accelerates mana.");
  } else if (isLowConfidenceRampText(card)) {
    add(signals, "ramp", "low", "Mana text exists but does not prove meaningful acceleration.");
  }
  const drawProfile = classifyDrawProfile(card);
  if (drawProfile.wheel) {
    add(signals, "wheel", "high", "Replaces hands or creates a wheel effect.");
    add(signals, "hand-cycling", "high", "Forces hand replacement or discard/draw churn.");
    add(signals, "card-draw", "high", "Creates meaningful multi-card draw.");
    add(signals, "card-advantage", "high", "Provides meaningful card velocity or advantage.");
  } else if (drawProfile.drawPunishment) {
    add(signals, "draw-punishment", "high", "Punishes card drawing.");
    add(signals, "burn", "medium", "Turns draw into damage or life loss.");
    add(signals, "synergy", "high", "Directly rewards a draw-punishment strategy.");
  } else if (drawProfile.groupDraw) {
    add(signals, "group-draw", "high", "Makes multiple players draw cards.");
    add(signals, "card-draw", "high", "Creates meaningful shared draw.");
    add(signals, "card-advantage", "medium", "Creates draw velocity but may help opponents.");
  } else if (drawProfile.engine) {
    add(signals, "card-draw", "high", "Provides repeatable or meaningful card draw.");
    add(signals, "card-advantage", "high", "Provides repeatable or meaningful resource advantage.");
  } else if (drawProfile.cantrip) {
    const incidental = drawProfile.hasPrimaryNonDrawRole;
    add(signals, "cantrip", incidental ? "medium" : "high", "Replaces itself with a card.");
    add(signals, "card-draw", incidental ? "low" : "medium", incidental ? "Incidental draw attached to another effect." : "One-shot card selection.");
    add(signals, "incidental-draw", incidental ? "medium" : "low", "Draw is not the primary strategic reason for the card.");
  } else if (drawProfile.conditional) {
    add(signals, "conditional-draw", "medium", "Draw depends on a board state or trigger.");
    add(signals, "card-draw", "medium", "Can produce cards in the right shell.");
    add(signals, "card-advantage", "medium", "Can provide conditional advantage.");
  }
  if (matches(haystack, ["counter target", "counterspell", "negate", "spell pierce", "exclude"])) {
    add(signals, "interaction", "high", "Interacts with opposing spells.");
    add(signals, "countermagic", "high", "Counters spells.");
  }
  if (matches(haystack, ["destroy target", "exile target", "damage to any target", "damage to target", "return target", "sacrifice target", "lightning bolt", "cast down", "snuff out", "journey to nowhere"])) {
    add(signals, "interaction", "high", "Answers opposing cards.");
    add(signals, "removal", "high", "Removes a card.");
    add(signals, "targeted-removal", "high", "Targets a specific card.");
  }
  if (matches(haystack, ["destroy all", "exile all", "each creature", "all creatures", "board wipe", "wrath"])) {
    add(signals, "interaction", "high", "Answers opposing cards.");
    add(signals, "removal", "high", "Removes cards.");
    add(signals, "board-wipe", "high", "Cleans up multiple creatures/permanents.");
    add(signals, "mass-removal", "high", "Mass removal effect.");
  }
  if (matches(haystack, ["hexproof", "indestructible", "protection from", "phase out", "prevent all damage", "boots", "greaves", "ward"])) {
    add(signals, "protection", "high", "Protects key permanents.");
  }
  if (matches(haystack, ["search your library", "tutor", "transmute"])) {
    add(signals, "tutor", "high", "Searches library for a card.");
  }
  if (matches(haystack, ["from your graveyard", "return target card", "return target creature card", "escape", "flashback", "dredge", "delve"])) {
    add(signals, "recursion", "high", "Reuses cards from graveyard.");
    add(signals, "graveyard-interaction", "high", "Uses the graveyard.");
    add(signals, "synergy", "medium", "Supports graveyard patterns.");
  }
  if (matches(haystack, ["create", "token", "populate", "doubling", "convoke"])) {
    add(signals, "token-generation", "high", "Creates or rewards tokens.");
    add(signals, "synergy", "medium", "Supports token strategies.");
  }
  if (typeLine.includes("goblin") || name.includes("goblin")) {
    add(signals, "goblin-payoff", "medium", "Contributes to Goblin typal density.");
    add(signals, "synergy", "medium", "Supports Goblin commander strategies.");
  }
  if ((typeLine.includes("goblin") || oracleText.includes("goblin")) && matches(haystack, ["create", "token", "tokens"])) {
    add(signals, "goblin-token-maker", "high", "Creates or scales Goblin tokens.");
  }
  if (matches(haystack, ["other goblin", "goblins you control", "goblin creatures you control", "goblin spells you cast"])) {
    add(signals, "goblin-payoff", "high", "Directly rewards Goblin cards.");
  }
  if (matches(haystack, ["have haste", "gain haste", "haste until", "creatures you control have haste"])) {
    add(signals, "haste-enabler", "high", "Lets the deck use tap or combat engines immediately.");
  }
  if (matches(haystack, ["sacrifice", "sacrifice another", "sacrifice a creature", "altar"])) {
    add(signals, "sacrifice-outlet", "high", "Sacrifice outlet or sacrifice engine.");
    add(signals, "synergy", "medium", "Supports sacrifice strategies.");
    add(signals, "combo-piece", "medium", "Can participate in engine loops.");
  }
  if (matches(haystack, ["dies", "aristocrat", "blood artist"])) {
    add(signals, "synergy", "medium", "Rewards death triggers.");
    add(signals, "combo-piece", "medium", "Can participate in engine loops.");
  }
  if (matches(haystack, ["discard a card", "discards a card", "then discards", "target player discards", "each opponent discards"])) {
    add(signals, "discard", "high", "Forces or uses discard.");
    add(signals, "interaction", "medium", "Attacks hand resources.");
  }
  if (matches(haystack, ["combo", "infinite", "untap", "station", "engine"])) {
    add(signals, "combo-piece", "medium", "Mentions combo/engine or untap patterns.");
    add(signals, "synergy", "medium", "Supports engine patterns.");
  }
  if (matches(haystack, ["gain life", "lifelink", "whenever you gain life"])) {
    add(signals, "lifegain", "high", "Gains life.");
    add(signals, "synergy", "medium", "Supports life-gain strategies.");
  }
  if (matches(haystack, ["damage to any target", "damage to target", "lightning bolt", "lava spike", "burn"])) {
    add(signals, "burn", "high", "Direct damage.");
    add(signals, "interaction", "medium", "Can interact through damage.");
  }
  if (typeLine.includes("creature") && typeLine.includes("human")) {
    add(signals, "human-payoff", "high", "Human creature can be a Winota hit.");
    add(signals, "synergy", "medium", "Supports Human payoff structures.");
  }
  if (typeLine.includes("creature") && !typeLine.includes("human")) {
    add(signals, "non-human-enabler", Number(cardManaValue(card)) <= 3 ? "high" : "medium", "Non-Human creature can enable Winota attacks.");
  }
  if (matches(haystack, ["attacks", "attacking", "combat damage", "haste"])) {
    add(signals, "attack-support", "high", "Supports attack-triggered game plans.");
  }
  if (matches(haystack, ["poison counter", "poison counters"])) add(signals, "poison", "high", "Advances poison-counter pressure.");
  if (haystack.includes("infect")) add(signals, "infect", "high", "Deals damage as poison counters.");
  if (haystack.includes("toxic")) add(signals, "toxic", "high", "Adds toxic poison pressure.");
  if (haystack.includes("proliferate")) add(signals, "proliferate", "high", "Multiplies existing counters.");
  if (matches(haystack, ["destroy target artifact", "exile target artifact", "artifact or enchantment", "shatter"])) {
    add(signals, "artifact-interaction", "high", "Answers artifacts.");
    add(signals, "interaction", "medium", "Answers opposing cards.");
  }
  if (matches(haystack, ["destroy target enchantment", "exile target enchantment", "artifact or enchantment", "naturalize"])) {
    add(signals, "enchantment-interaction", "high", "Answers enchantments.");
    add(signals, "interaction", "medium", "Answers opposing cards.");
  }
  if (typeLine.includes("creature") && !signals.some((signal) => signal.role === "ramp" && signal.confidence === "high")) {
    add(signals, "threat", "medium", "Creature body can pressure opponents.");
  }
  if (matches(haystack, ["can't be blocked", "trample", "double strike", "haste", "deal combat damage"]) || Number(cardManaValue(card)) >= 6) {
    add(signals, "finisher", "medium", "Can help close a game.");
  }

  return dedupeSignals(signals.length ? signals : [{ role: "synergy", confidence: "low", confidenceScore: 0.2, reason: "No stronger role evidence." }]);
}

function matches(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function add(signals: RoleSignal[], role: DeckArchitectRole, confidence: RoleSignal["confidence"], reason: string) {
  const confidenceScore = confidence === "high" ? 0.9 : confidence === "medium" ? 0.6 : 0.25;
  signals.push({ role, confidence, confidenceScore, reason });
}

function classifyDrawProfile(card: RoleInput) {
  const typeLine = card.typeLine?.toLowerCase() ?? "";
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  const name = card.name.toLowerCase();
  const haystack = `${name} ${typeLine} ${oracleText}`;
  const hasPrimaryNonDrawRole = matches(haystack, [
    "counter target",
    "destroy target",
    "exile target",
    "damage to any target",
    "damage to target",
    "return target",
    "sacrifice target",
  ]);
  const wheel = matches(haystack, [
    "wheel of fortune",
    "windfall",
    "winds of change",
    "reversal of fortune",
    "reforge the soul",
    "wheel and deal",
    "dark deal",
    "whispering madness",
    "commit // memory",
    "time reversal",
    "each player discards their hand",
    "discard their hands",
    "then draws that many cards",
    "draws cards equal to the greatest number of cards a player discarded",
    "shuffles their hand and graveyard into their library, then draws",
  ]);
  const drawPunishment = matches(haystack, [
    "whenever an opponent draws",
    "whenever a player draws",
    "whenever one or more opponents draw",
    "draws a card, ",
    "draws a card.",
  ]) && matches(haystack, ["deals", "damage", "loses", "lose 1 life", "life loss", "underworld dreams", "spiteful visions", "fate unraveler", "psychosis crawler"]);
  const groupDraw = matches(haystack, [
    "each player draws",
    "each opponent draws",
    "target player draws",
    "players draw",
    "opponent draws",
    "opponents draw",
  ]);
  const engine = matches(haystack, [
    "whenever you draw",
    "whenever you cast",
    "at the beginning of your upkeep, you draw",
    "whenever an opponent casts",
    "rhystic",
    "mystic remora",
    "draw two cards",
    "draw three cards",
    "draws two cards",
    "draws three cards",
    "exile the top",
    "impulse",
  ]);
  const cantrip = matches(haystack, ["draw a card", "ponder", "preordain", "brainstorm", "consider", "opt"]);
  const conditional = matches(haystack, ["if you", "whenever", "at the beginning", "unless", "for each"]);
  return {
    wheel,
    drawPunishment,
    groupDraw,
    engine,
    cantrip,
    conditional,
    hasPrimaryNonDrawRole,
  };
}

function dedupeSignals(signals: RoleSignal[]) {
  const byRole = new Map<DeckArchitectRole, RoleSignal>();
  for (const signal of signals) {
    const previous = byRole.get(signal.role);
    if (!previous || signal.confidenceScore > previous.confidenceScore) byRole.set(signal.role, signal);
  }
  return [...byRole.values()];
}

function isHighConfidenceRamp(card: RoleInput) {
  const typeLine = card.typeLine?.toLowerCase() ?? "";
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  const name = card.name.toLowerCase();
  if (isConditionalTreasure(card)) return false;
  if (matches(name, ["sol ring", "arcane signet", "signet", "talisman", "cultivate", "kodama's reach", "nature's lore", "skirk prospector"])) return true;
  if (matches(oracleText, ["add two mana", "add two colorless", "add three mana", "search your library for up to two basic land cards", "put a land card onto the battlefield", "put those cards onto the battlefield", "you may play an additional land"])) return true;
  if (/add\s+\w+\s+and\s+\w+\s+mana/.test(oracleText)) return true;
  if (/add\s+(white|blue|black|red|green)\s+and\s+(white|blue|black|red|green)\s+mana/.test(oracleText)) return true;
  if (
    matches(oracleText, ["add one mana of any color", "add one mana of the chosen color", "add one mana of any color in your commander's color identity"]) &&
    !typeLine.includes("land") &&
    (isManaRock(card) || isManaDork(card))
  ) return true;
  if (matches(oracleText, ["create a treasure token", "create two treasure tokens", "create x treasure tokens"])) return true;
  if (matches(oracleText, ["creature spells you cast cost", "goblin spells you cast cost", "spells you cast cost"])) return true;
  if (matches(oracleText, ["sacrifice a goblin: add", "sacrifice a creature: add"])) return true;
  return false;
}

function colorFixingProfile(card: RoleInput): { confidence: RoleSignal["confidence"] | null; reason: string } {
  const typeLine = card.typeLine?.toLowerCase() ?? "";
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  const reliableFixingText =
    matches(oracleText, [
      "add one mana of any color",
      "add one mana of the chosen color",
      "add one mana of any color in your commander's color identity",
      "mana of any color that a land an opponent controls could produce",
    ]) ||
    /add\s+(white|blue|black|red|green)\s+and\s+(white|blue|black|red|green)\s+mana/.test(oracleText);
  if (!reliableFixingText) return { confidence: null, reason: "" };
  if (isConditionalTreasure(card)) return { confidence: null, reason: "" };
  if (typeLine.includes("land")) return { confidence: "medium", reason: "Land can produce multiple colors in the right deck context." };
  if (isManaRock(card) || isManaDork(card)) return { confidence: "high", reason: "Repeatable mana source improves access to required colors." };
  return { confidence: null, reason: "" };
}

function isLandFixing(card: RoleInput) {
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  return matches(oracleText, ["search your library for a forest card", "search your library for up to two basic land cards", "put a land card onto the battlefield", "search your library for a basic land"]);
}

function isManaRock(card: RoleInput) {
  const typeLine = card.typeLine?.toLowerCase() ?? "";
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  return typeLine.includes("artifact") &&
    hasRepeatableManaAbility(oracleText) &&
    (matches(oracleText, ["add two colorless", "add one mana", "add one mana of any color", "add one mana of the chosen color"]) || /add\s+(white|blue|black|red|green)\s+and\s+(white|blue|black|red|green)\s+mana/.test(oracleText));
}

function isManaDork(card: RoleInput) {
  const typeLine = card.typeLine?.toLowerCase() ?? "";
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  return typeLine.includes("creature") &&
    hasRepeatableManaAbility(oracleText) &&
    matches(oracleText, ["add one mana", "add one mana of any color", "add one mana of the chosen color"]);
}

function hasRepeatableManaAbility(oracleText: string) {
  return matches(oracleText, ["tap: add", "{t}: add", "sacrifice a goblin: add", "sacrifice a creature: add"]) ||
    /^add\s/.test(oracleText.trim());
}

function isRitual(card: RoleInput) {
  const typeLine = card.typeLine?.toLowerCase() ?? "";
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  return !typeLine.includes("permanent") && matches(oracleText, ["add three mana", "add two mana", "add rrr", "add {r}{r}{r}"]);
}

function isTreasureGeneration(card: RoleInput) {
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  return matches(oracleText, ["create a treasure token", "create two treasure tokens", "create x treasure tokens"]);
}

function isConditionalTreasure(card: RoleInput) {
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  return matches(oracleText, ["if you", "if it", "if a", "if an", "if this", "if you committed a crime"]) && oracleText.includes("create a treasure token");
}

function isCostReduction(card: RoleInput) {
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  return matches(oracleText, ["spells you cast cost", "creature spells you cast cost", "goblin spells you cast cost", "costs 1 less", "cost {1} less"]);
}

function isLowConfidenceRampText(card: RoleInput) {
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  return matches(oracleText, ["mana", "treasure", "land", "add", "cost"]);
}

function cardManaValue(card: RoleInput) {
  const manaCost = card.manaCost ?? "";
  const generic = manaCost.match(/\{(\d+)\}/g)?.reduce((sum, token) => sum + Number(token.replace(/[{}]/g, "")), 0) ?? 0;
  const pips = manaCost.match(/\{[WUBRGC]\}/g)?.length ?? 0;
  return generic + pips;
}
