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
  if (isColorFixing(card)) {
    add(signals, "mana-fixing", typeLine.includes("land") ? "medium" : "high", "Produces or fixes mana.");
    add(signals, "color-fixing", typeLine.includes("land") ? "medium" : "high", "Improves access to required colors.");
  }
  if (isLandFixing(card)) add(signals, "land-fixing", "high", "Searches or improves lands.");
  if (isManaRock(card)) add(signals, "mana-rock", "high", "Artifact that produces mana.");
  if (isManaDork(card)) add(signals, "mana-dork", "high", "Creature that produces mana.");
  if (isRitual(card)) add(signals, "ritual", "high", "Temporary burst mana.");
  if (isTreasureGeneration(card)) add(signals, "treasure-generation", isConditionalTreasure(card) ? "medium" : "high", isConditionalTreasure(card) ? "Conditionally creates Treasure." : "Creates Treasure mana.");
  if (isCostReduction(card)) add(signals, "cost-reduction", "high", "Reduces spell or typal costs.");
  if (isHighConfidenceRamp(card)) {
    add(signals, "ramp", "high", "Meaningfully accelerates mana.");
  } else if (isLowConfidenceRampText(card)) {
    add(signals, "ramp", "low", "Mana text exists but does not prove meaningful acceleration.");
  }
  if (matches(haystack, ["draw a card", "draw cards", "draw two cards", "draws two cards", "draw three cards", "draws three cards", "whenever you draw", "look at the top", "ponder", "preordain", "brainstorm", "consider", "rhystic", "remora", "impulse"])) {
    add(signals, "card-draw", "high", "Provides card draw or selection.");
    add(signals, "card-advantage", "high", "Provides card advantage.");
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
  if (matches(name, ["sol ring", "arcane signet", "signet", "talisman", "cultivate", "kodama's reach", "nature's lore", "skirk prospector"])) return true;
  if (matches(oracleText, ["add two mana", "add two colorless", "add three mana", "search your library for up to two basic land cards", "put a land card onto the battlefield", "put those cards onto the battlefield", "you may play an additional land"])) return true;
  if (/add\s+\w+\s+and\s+\w+\s+mana/.test(oracleText)) return true;
  if (/add\s+(white|blue|black|red|green)\s+and\s+(white|blue|black|red|green)\s+mana/.test(oracleText)) return true;
  if (matches(oracleText, ["add one mana of any color", "add one mana of the chosen color", "add one mana of any color in your commander's color identity"]) && !typeLine.includes("land")) return true;
  if (oracleText.includes("if ") && oracleText.includes("create a treasure token")) return false;
  if (matches(oracleText, ["create a treasure token", "create two treasure tokens", "create x treasure tokens"])) return true;
  if (matches(oracleText, ["creature spells you cast cost", "goblin spells you cast cost", "spells you cast cost"])) return true;
  if (matches(oracleText, ["sacrifice a goblin: add", "sacrifice a creature: add"])) return true;
  return false;
}

function isColorFixing(card: RoleInput) {
  const typeLine = card.typeLine?.toLowerCase() ?? "";
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  return typeLine.includes("land") ||
    matches(oracleText, ["add one mana of any color", "add one mana of the chosen color", "mana of any color"]) ||
    /add\s+(white|blue|black|red|green)\s+and\s+(white|blue|black|red|green)\s+mana/.test(oracleText);
}

function isLandFixing(card: RoleInput) {
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  return matches(oracleText, ["search your library for a forest card", "search your library for up to two basic land cards", "put a land card onto the battlefield", "search your library for a basic land"]);
}

function isManaRock(card: RoleInput) {
  const typeLine = card.typeLine?.toLowerCase() ?? "";
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  return typeLine.includes("artifact") && (matches(oracleText, ["add two colorless", "add one mana", "add one mana of any color", "add one mana of the chosen color"]) || /add\s+(white|blue|black|red|green)\s+and\s+(white|blue|black|red|green)\s+mana/.test(oracleText));
}

function isManaDork(card: RoleInput) {
  const typeLine = card.typeLine?.toLowerCase() ?? "";
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  return typeLine.includes("creature") && matches(oracleText, ["add one mana", "add one mana of any color", "add one mana of the chosen color"]);
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
  return oracleText.includes("if ") && oracleText.includes("create a treasure token");
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
