import type { CollectionGraphCard, DeckArchetypeTaxonomy } from "./types.ts";

export type PrimaryArchetype =
  | "aggro"
  | "midrange"
  | "control"
  | "combo"
  | "tempo"
  | "ramp"
  | "aggro-control"
  | "aggro-combo"
  | "midrange-combo"
  | "control-combo"
  | "tempo-midrange"
  | "ramp-combo";

export type StrategyTag = string;
export type ThemeTag = string;
export type TypalTag = string;
export type MechanicTag = string;

export const STRATEGY_TAGS = [
  "Burn",
  "Sligh",
  "RDW",
  "Stompy",
  "Zoo",
  "Go-Wide",
  "Go-Tall",
  "Tokens",
  "Aristocrats",
  "Sacrifice",
  "Reanimator",
  "Graveyard Value",
  "Self-Mill",
  "Mill",
  "Ramp",
  "Big Mana",
  "Toolbox",
  "Value",
  "Blink",
  "Flicker",
  "ETB",
  "LTB",
  "Counters",
  "Enchantress",
  "Artifacts",
  "Equipment",
  "Vehicles",
  "Lands",
  "Landfall",
  "Spellslinger",
  "Storm",
  "Prowess",
  "Auras",
  "Voltron",
  "Prison",
  "Stax",
  "Taxes",
  "Discard",
  "Draw-Go",
  "Tap-Out Control",
  "Pillow Fort",
  "Wheels",
  "Theft",
  "Politics",
  "Goad",
  "Group Hug",
  "Group Slug",
  "Lifegain",
  "Life Drain",
  "Combo",
  "Typal",
  "Superfriends",
  "Treasure",
  "Food",
  "Clues",
] as const;

export const THEME_TAGS = [
  "Graveyard",
  "Artifacts",
  "Enchantments",
  "Lands",
  "Tokens",
  "Counters",
  "Treasure",
  "Food",
  "Clues",
  "Blood",
  "Equipment",
  "Vehicles",
  "Sagas",
  "Curses",
  "Shrines",
  "Planeswalkers",
  "ETB",
  "LTB",
  "Cast From Exile",
  "Topdeck",
  "Big Creatures",
  "Combat",
  "Forced Combat",
  "Sea Monsters",
  "Alternate Win Conditions",
] as const;

const CREATURE_TYPE_STOP_WORDS = new Set([
  "artifact",
  "basic",
  "battle",
  "creature",
  "enchantment",
  "instant",
  "kindred",
  "land",
  "legendary",
  "planeswalker",
  "snow",
  "sorcery",
  "token",
]);

export function detectCardTaxonomy(card: Pick<CollectionGraphCard, "name" | "typeLine" | "oracleText">): DeckArchetypeTaxonomy {
  const text = `${card.name} ${card.typeLine ?? ""} ${card.oracleText ?? ""}`.toLowerCase();
  return compactTaxonomy({
    primaryArchetypes: detectPrimaryArchetypes(text),
    strategies: detectStrategies(text),
    themes: detectThemes(text),
    typal: detectTypal(card.typeLine),
    mechanics: detectMechanics(text),
  });
}

export function compactTaxonomy(taxonomy: DeckArchetypeTaxonomy): DeckArchetypeTaxonomy {
  return {
    primaryArchetypes: unique(taxonomy.primaryArchetypes),
    strategies: unique(taxonomy.strategies),
    themes: unique(taxonomy.themes),
    typal: unique(taxonomy.typal),
    mechanics: unique(taxonomy.mechanics),
  };
}

function detectPrimaryArchetypes(text: string): PrimaryArchetype[] {
  const archetypes: PrimaryArchetype[] = [];
  if (has(text, ["attack", "combat damage", "haste", "prowess"])) archetypes.push("aggro");
  if (has(text, ["counter target", "draw a card", "destroy target", "exile target"])) archetypes.push("control");
  if (has(text, ["combo", "untap", "whenever you cast", "copy target"])) archetypes.push("combo");
  if (has(text, ["land", "add one mana", "search your library for a land"])) archetypes.push("ramp");
  if (!archetypes.length && has(text, ["creature", "return", "value"])) archetypes.push("midrange");
  return archetypes;
}

function detectStrategies(text: string): StrategyTag[] {
  const tags: StrategyTag[] = [];
  if (has(text, ["damage to any target", "burn"])) tags.push("Burn");
  if (has(text, ["sacrifice", "dies", "death trigger"])) tags.push("Aristocrats", "Sacrifice");
  if (has(text, ["return", "from your graveyard", "reanimate"])) tags.push("Reanimator", "Graveyard Value");
  if (has(text, ["mill", "surveil"])) tags.push("Self-Mill", "Mill");
  if (has(text, ["create", "token"])) tags.push("Tokens");
  if (has(text, ["+1/+1 counter", "proliferate"])) tags.push("Counters");
  if (has(text, ["artifact", "treasure"])) tags.push("Artifacts");
  if (has(text, ["equipment", "equipped"])) tags.push("Equipment", "Voltron");
  if (has(text, ["instant", "sorcery", "noncreature spell"])) tags.push("Spellslinger");
  if (has(text, ["poison", "toxic", "infect"])) tags.push("Combo");
  if (has(text, ["planeswalker", "loyalty"])) tags.push("Superfriends");
  if (has(text, ["landfall"])) tags.push("Landfall");
  if (has(text, ["goad", "attacks each combat if able"])) tags.push("Goad", "Politics");
  return tags;
}

function detectThemes(text: string): ThemeTag[] {
  const tags: ThemeTag[] = [];
  if (has(text, ["graveyard", "escape", "flashback", "unearth"])) tags.push("Graveyard");
  if (has(text, ["artifact", "treasure"])) tags.push("Artifacts");
  if (has(text, ["enchantment", "aura", "saga"])) tags.push("Enchantments");
  if (has(text, ["landfall", "land card"])) tags.push("Lands");
  if (has(text, ["token"])) tags.push("Tokens");
  if (has(text, ["counter", "proliferate"])) tags.push("Counters");
  if (has(text, ["treasure"])) tags.push("Treasure");
  if (has(text, ["food"])) tags.push("Food");
  if (has(text, ["clue"])) tags.push("Clues");
  if (has(text, ["blood token"])) tags.push("Blood");
  if (has(text, ["equipment"])) tags.push("Equipment");
  if (has(text, ["vehicle", "crew"])) tags.push("Vehicles");
  if (has(text, ["planeswalker"])) tags.push("Planeswalkers");
  if (has(text, ["enters the battlefield"])) tags.push("ETB");
  if (has(text, ["leaves the battlefield"])) tags.push("LTB");
  if (has(text, ["exile", "cast"])) tags.push("Cast From Exile");
  if (has(text, ["top card of your library", "scry"])) tags.push("Topdeck");
  if (has(text, ["goad", "attacks each combat if able"])) tags.push("Forced Combat");
  if (has(text, ["you win the game", "poison counter"])) tags.push("Alternate Win Conditions");
  return tags;
}

function detectMechanics(text: string): MechanicTag[] {
  const mechanics: MechanicTag[] = [];
  if (has(text, ["proliferate"])) mechanics.push("Proliferate");
  if (has(text, ["+1/+1 counter"])) mechanics.push("+1/+1 Counters");
  if (has(text, ["poison counter"])) mechanics.push("Poison");
  if (has(text, ["infect"])) mechanics.push("Infect");
  if (has(text, ["toxic"])) mechanics.push("Toxic");
  if (has(text, ["energy counter"])) mechanics.push("Energy");
  if (has(text, ["cascade"])) mechanics.push("Cascade");
  if (has(text, ["discover"])) mechanics.push("Discover");
  if (has(text, ["suspend"])) mechanics.push("Suspend");
  if (has(text, ["flashback"])) mechanics.push("Flashback");
  if (has(text, ["escape"])) mechanics.push("Escape");
  if (has(text, ["unearth"])) mechanics.push("Unearth");
  if (has(text, ["descend"])) mechanics.push("Descend");
  if (has(text, ["delirium"])) mechanics.push("Delirium");
  if (has(text, ["threshold"])) mechanics.push("Threshold");
  if (has(text, ["madness"])) mechanics.push("Madness");
  if (has(text, ["magecraft"])) mechanics.push("Magecraft");
  if (has(text, ["prowess"])) mechanics.push("Prowess");
  if (has(text, ["landfall"])) mechanics.push("Landfall");
  if (has(text, ["constellation"])) mechanics.push("Constellation");
  if (has(text, ["devotion"])) mechanics.push("Devotion");
  if (has(text, ["monarch"])) mechanics.push("Monarch");
  if (has(text, ["initiative"])) mechanics.push("Initiative");
  if (has(text, ["dungeon"])) mechanics.push("Dungeons");
  if (has(text, ["experience counter"])) mechanics.push("Experience Counters");
  if (has(text, ["morph"])) mechanics.push("Morph");
  if (has(text, ["manifest"])) mechanics.push("Manifest");
  if (has(text, ["disguise"])) mechanics.push("Disguise");
  if (has(text, ["roll", "die", "dice"])) mechanics.push("Dice");
  if (has(text, ["coin flip"])) mechanics.push("Coin Flips");
  return mechanics;
}

function detectTypal(typeLine?: string | null): TypalTag[] {
  const creaturePart = typeLine?.split("—")[1] ?? typeLine?.split("-")[1] ?? "";
  return unique(
    creaturePart
      .split(/\s+/)
      .map((part) => part.replace(/[^A-Za-z]/g, ""))
      .filter((part) => part.length > 2)
      .filter((part) => !CREATURE_TYPE_STOP_WORDS.has(part.toLowerCase())),
  );
}

function has(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}
