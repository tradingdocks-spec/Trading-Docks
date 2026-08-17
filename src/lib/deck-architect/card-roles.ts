import type { CollectionGraphCard, DeckArchitectRole, DeckRequirement } from "./types.ts";

type RoleInput = Pick<CollectionGraphCard | DeckRequirement, "name" | "oracleText" | "typeLine" | "manaCost">;

export function classifyCardRoles(card: RoleInput): DeckArchitectRole[] {
  const typeLine = card.typeLine?.toLowerCase() ?? "";
  const oracleText = card.oracleText?.toLowerCase() ?? "";
  const name = card.name.toLowerCase();
  const haystack = `${name} ${typeLine} ${oracleText}`;
  const roles: DeckArchitectRole[] = [];

  if (typeLine.includes("land")) roles.push("land", "mana-fixing");
  if (matches(haystack, ["add one mana", "add two mana", "treasure token", "search your library for a land", "ramp", "signet", "sol ring", "cultivate", "kodama's reach", "nature's lore"])) {
    roles.push("ramp", "mana-fixing");
  }
  if (matches(haystack, ["draw a card", "draw two cards", "draw three cards", "whenever you draw", "look at the top", "ponder", "preordain", "brainstorm", "consider", "rhystic", "remora", "impulse"])) {
    roles.push("card-advantage");
  }
  if (matches(haystack, ["counter target", "counterspell", "negate", "spell pierce", "exclude"])) {
    roles.push("interaction", "countermagic");
  }
  if (matches(haystack, ["destroy target", "exile target", "damage to any target", "damage to target", "return target", "sacrifice target", "lightning bolt", "cast down", "snuff out", "journey to nowhere"])) {
    roles.push("interaction", "removal");
  }
  if (matches(haystack, ["destroy all", "exile all", "each creature", "all creatures", "board wipe", "wrath"])) {
    roles.push("interaction", "board-wipe");
  }
  if (matches(haystack, ["hexproof", "indestructible", "protection from", "phase out", "prevent all damage", "boots", "greaves", "ward"])) {
    roles.push("protection");
  }
  if (matches(haystack, ["search your library", "tutor", "transmute"])) {
    roles.push("tutor");
  }
  if (matches(haystack, ["from your graveyard", "return target card", "return target creature card", "escape", "flashback", "dredge", "delve"])) {
    roles.push("graveyard-interaction", "synergy");
  }
  if (matches(haystack, ["create", "token", "populate", "doubling", "convoke"])) {
    roles.push("synergy");
  }
  if (matches(haystack, ["sacrifice", "dies", "aristocrat", "blood artist", "altar"])) {
    roles.push("synergy", "combo-piece");
  }
  if (matches(haystack, ["combo", "infinite", "untap", "station", "engine"])) {
    roles.push("combo-piece", "synergy");
  }
  if (typeLine.includes("creature") && !roles.includes("ramp")) {
    roles.push("threat");
  }
  if (matches(haystack, ["can't be blocked", "trample", "double strike", "haste", "deal combat damage"]) || Number(cardManaValue(card)) >= 6) {
    roles.push("finisher");
  }

  return [...new Set<DeckArchitectRole>(roles.length ? roles : ["synergy"])];
}

function matches(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function cardManaValue(card: RoleInput) {
  const manaCost = card.manaCost ?? "";
  const generic = manaCost.match(/\{(\d+)\}/g)?.reduce((sum, token) => sum + Number(token.replace(/[{}]/g, "")), 0) ?? 0;
  const pips = manaCost.match(/\{[WUBRGC]\}/g)?.length ?? 0;
  return generic + pips;
}
