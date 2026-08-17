import type { BuildIntentId, CollectionGraphCard, CommanderStrategyProfile, DeckKnowledgeCardSeed } from "./types.ts";
import { classifyCardRoles } from "./card-roles.ts";
import { normalizeCardKey } from "./ownership.ts";

const GENERIC_COMMANDER_CATALOG: DeckKnowledgeCardSeed[] = [
  seed("Sol Ring", 1, ["ramp"], 1.5, "Artifact", "Add two colorless mana."),
  seed("Arcane Signet", 1, ["ramp", "mana-fixing"], 0.75, "Artifact", "Add one mana of any color in your commander's color identity."),
  seed("Command Tower", 1, ["land", "mana-fixing"], 0.35, "Land", "Add one mana of any color in your commander's color identity."),
  seed("Path of Ancestry", 1, ["land", "mana-fixing"], 0.4, "Land", "Add one mana of any color in your commander's color identity. Scry 1."),
  seed("Swiftfoot Boots", 1, ["protection"], 1.25, "Artifact - Equipment", "Equipped creature has hexproof and haste."),
  seed("Lightning Greaves", 1, ["protection"], 4.5, "Artifact - Equipment", "Equipped creature has haste and shroud."),
  seed("Heroic Intervention", 1, ["protection"], 9, "Instant", "Permanents you control gain hexproof and indestructible.", ["G"]),
  seed("Beast Within", 1, ["interaction", "removal"], 1.25, "Instant", "Destroy target permanent.", ["G"]),
  seed("Swords to Plowshares", 1, ["interaction", "removal"], 1, "Instant", "Exile target creature.", ["W"]),
  seed("Counterspell", 1, ["interaction", "countermagic"], 0.5, "Instant", "Counter target spell.", ["U"]),
  seed("Feed the Swarm", 1, ["interaction", "removal", "enchantment-interaction"], 0.4, "Sorcery", "Destroy target creature or enchantment.", ["B"]),
  seed("Chaos Warp", 1, ["interaction", "removal"], 1, "Instant", "Shuffle target permanent into its owner's library.", ["R"]),
  seed("Generous Gift", 1, ["interaction", "removal"], 0.75, "Instant", "Destroy target permanent.", ["W"]),
  seed("Cyclonic Rift", 1, ["interaction", "mass-removal"], 35, "Instant", "Return target nonland permanent you don't control.", ["U"]),
  seed("Toxic Deluge", 1, ["mass-removal", "board-wipe"], 18, "Sorcery", "All creatures get -X/-X until end of turn.", ["B"]),
  seed("Blasphemous Act", 1, ["mass-removal", "board-wipe"], 2.5, "Sorcery", "This spell deals 13 damage to each creature.", ["R"]),
  seed("Farewell", 1, ["mass-removal", "board-wipe"], 2.75, "Sorcery", "Choose one or more. Exile artifacts, creatures, enchantments, graveyards.", ["W"]),
  seed("Nature's Lore", 1, ["ramp", "mana-fixing"], 2, "Sorcery", "Search your library for a Forest card.", ["G"]),
  seed("Cultivate", 1, ["ramp", "mana-fixing"], 0.3, "Sorcery", "Search your library for up to two basic land cards.", ["G"]),
  seed("Kodama's Reach", 1, ["ramp", "mana-fixing"], 0.3, "Sorcery", "Search your library for up to two basic land cards.", ["G"]),
  seed("Rhystic Study", 1, ["card-draw", "card-advantage"], 40, "Enchantment", "Whenever an opponent casts a spell, you may draw a card unless they pay 1.", ["U"]),
  seed("Mystic Remora", 1, ["card-draw", "card-advantage"], 8, "Enchantment", "Whenever an opponent casts a noncreature spell, you may draw a card unless they pay 4.", ["U"]),
  seed("Esper Sentinel", 1, ["card-draw", "card-advantage"], 25, "Artifact Creature - Human Soldier", "Whenever an opponent casts their first noncreature spell each turn, draw unless they pay X.", ["W"]),
  seed("Phyrexian Arena", 1, ["card-draw", "card-advantage"], 2, "Enchantment", "At the beginning of your upkeep, you draw a card and lose 1 life.", ["B"]),
  seed("Skullclamp", 1, ["card-draw", "card-advantage"], 5, "Artifact - Equipment", "Equipped creature gets +1/-1. Whenever equipped creature dies, draw two cards."),
  seed("Eternal Witness", 1, ["recursion", "card-advantage"], 2.5, "Creature - Human Shaman", "Return target card from your graveyard to your hand.", ["G"]),
  seed("Regrowth", 1, ["recursion"], 1.5, "Sorcery", "Return target card from your graveyard to your hand.", ["G"]),
];

const STRATEGY_CATALOG: Record<string, DeckKnowledgeCardSeed[]> = {
  "atraxa-counters": [
    seed("Deepglow Skate", 1, ["synergy", "finisher"], 4, "Creature - Fish", "Double the number of each kind of counter on any number of target permanents.", ["U"]),
    seed("Branching Evolution", 1, ["synergy"], 7, "Enchantment", "If one or more +1/+1 counters would be put on a creature you control, twice that many are put instead.", ["G"]),
    seed("Kami of Whispered Hopes", 1, ["ramp", "synergy"], 1.5, "Creature - Spirit", "If counters would be put on a permanent you control, put that many plus one.", ["G"]),
    seed("Lae'zel, Vlaakith's Champion", 1, ["synergy"], 1.25, "Legendary Creature - Gith Warrior", "If you would put counters on a creature or planeswalker, put that many plus one.", ["W"]),
    seed("Tekuthal, Inquiry Dominus", 1, ["synergy", "protection"], 4, "Legendary Creature - Phyrexian Horror", "If you would proliferate, proliferate twice instead.", ["U"]),
  ],
  "atraxa-poison": [
    seed("Infectious Inquiry", 1, ["card-draw", "synergy"], 0.2, "Sorcery", "You draw two cards and each opponent gets a poison counter.", ["B"]),
    seed("Prologue to Phyresis", 1, ["card-draw", "synergy"], 0.4, "Instant", "Each opponent gets a poison counter. Draw a card.", ["U"]),
    seed("Venerated Rotpriest", 1, ["synergy", "threat"], 12, "Creature - Phyrexian Druid", "Whenever a creature you control becomes the target of a spell, target opponent gets a poison counter.", ["G"]),
    seed("Bloated Contaminator", 1, ["threat", "synergy"], 3, "Creature - Phyrexian Beast", "Toxic 1. Whenever it deals combat damage to a player, proliferate.", ["G"]),
    seed("Tekuthal, Inquiry Dominus", 1, ["synergy", "protection"], 4, "Legendary Creature - Phyrexian Horror", "If you would proliferate, proliferate twice instead.", ["U"]),
    seed("Norn's Decree", 1, ["protection", "synergy"], 1.5, "Enchantment", "Whenever one or more creatures an opponent controls deal combat damage to you, that opponent gets a poison counter.", ["W"]),
  ],
  "atraxa-superfriends": [
    seed("Vorinclex, Monstrous Raider", 1, ["synergy", "finisher"], 30, "Legendary Creature - Phyrexian Praetor", "If you would put counters on a permanent or player, put twice that many.", ["G"]),
    seed("Teferi, Master of Time", 1, ["card-advantage", "synergy"], 10, "Legendary Planeswalker - Teferi", "You may activate loyalty abilities on any player's turn.", ["U"]),
    seed("Tamiyo, Field Researcher", 1, ["card-advantage", "protection"], 4, "Legendary Planeswalker - Tamiyo", "Draw cards and control combat.", ["G", "W", "U"]),
    seed("Evolution Sage", 1, ["synergy"], 1.5, "Creature - Elf Druid", "Whenever a land enters the battlefield under your control, proliferate.", ["G"]),
  ],
  "muldrotha-permanent-recursion": [
    seed("Seal of Removal", 1, ["interaction", "recursion"], 0.5, "Enchantment", "Sacrifice Seal of Removal: Return target creature to its owner's hand.", ["U"]),
    seed("Spore Frog", 1, ["protection", "recursion"], 0.75, "Creature - Frog", "Sacrifice Spore Frog: Prevent all combat damage this turn.", ["G"]),
    seed("The Gitrog Monster", 1, ["card-advantage", "land", "graveyard-interaction"], 6, "Legendary Creature - Frog Horror", "Draw when land cards are put into your graveyard.", ["B", "G"]),
  ],
  "muldrotha-sacrifice": [
    seed("Ashnod's Altar", 1, ["sacrifice-outlet", "combo-piece"], 8, "Artifact", "Sacrifice a creature: Add two colorless mana."),
    seed("Bastion of Remembrance", 1, ["synergy", "finisher"], 0.75, "Enchantment", "Whenever a creature you control dies, each opponent loses 1 life and you gain 1 life.", ["B"]),
  ],
};

export function getCommanderCatalogCandidates({
  commander,
  intentId,
  strategy,
}: {
  commander: CollectionGraphCard;
  intentId: BuildIntentId;
  strategy: CommanderStrategyProfile | null;
}): DeckKnowledgeCardSeed[] {
  if (intentId === "no-purchases") return [];
  const seeds = [
    ...GENERIC_COMMANDER_CATALOG,
    ...(strategy ? STRATEGY_CATALOG[strategy.id] ?? [] : []),
    ...(strategy?.coreCards ?? []),
    ...(strategy?.flexCards ?? []),
  ];
  return uniqueSeeds(seeds)
    .filter((candidate) => seedFitsCommander(candidate, commander))
    .filter((candidate) => intentId !== "budget" || candidate.estimatedPrice !== null)
    .filter((candidate) => intentId !== "budget" || (candidate.estimatedPrice ?? Number.POSITIVE_INFINITY) <= 25)
    .map((candidate) => ({
      ...candidate,
      roles: candidate.roles.length ? candidate.roles : classifyCardRoles({
        name: candidate.name,
        typeLine: candidate.typeLine,
        oracleText: candidate.oracleText,
      }),
    }));
}

function seed(
  name: string,
  quantity: number,
  roles: DeckKnowledgeCardSeed["roles"],
  estimatedPrice: number | null,
  typeLine: string,
  oracleText = "",
  colorIdentity: string[] = [],
): DeckKnowledgeCardSeed {
  return {
    name,
    quantity,
    roles,
    estimatedPrice,
    typeLine,
    oracleText,
    colorIdentity,
    importance: 1,
  };
}

function seedFitsCommander(seedCard: DeckKnowledgeCardSeed, commander: CollectionGraphCard) {
  const colors = seedCard.colorIdentity ?? [];
  const commanderColors = commander.colorIdentity ?? [];
  return colors.every((color) => commanderColors.includes(color));
}

function uniqueSeeds(seeds: DeckKnowledgeCardSeed[]) {
  const seen = new Set<string>();
  const unique: DeckKnowledgeCardSeed[] = [];
  for (const seedCard of seeds) {
    const key = normalizeCardKey(seedCard.name);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(seedCard);
  }
  return unique;
}
