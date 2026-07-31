import { NextRequest, NextResponse } from "next/server";

const FORMAT_CODE: Record<string, string> = {
  EDH: "commander",
  "Pauper EDH": "paupercommander",
  Standard: "standard",
  Modern: "modern",
  Pioneer: "pioneer",
  Legacy: "legacy",
  Vintage: "vintage",
  Alchemy: "alchemy",
  Premodern: "premodern",
  Pauper: "pauper",
};

type ScryfallCard = {
  id: string;
  name: string;
  cmc?: number;
  colors?: string[];
  color_identity?: string[];
  type_line?: string;
  oracle_text?: string;
  keywords?: string[];
  set?: string;
  set_name?: string;
  collector_number?: string;
  image_uris?: Record<string, string>;
  card_faces?: Array<{
    image_uris?: Record<string, string>;
    oracle_text?: string;
  }>;
  prices?: { usd?: string; usd_foil?: string };
  game_changer?: boolean;
};

type CardRole = {
  label: string;
  explanation: string;
  query: string;
  signals: string[];
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const format = String(body.format ?? "EDH");
    const commanderColors = Array.isArray(body.commanderColors)
      ? body.commanderColors.filter((color: unknown) =>
          ["W", "U", "B", "R", "G"].includes(String(color)),
        )
      : [];

    if (!name) {
      return NextResponse.json(
        { error: "Choose a card to replace." },
        { status: 400 },
      );
    }

    const sourceResponse = await scryfall(
      `/cards/named?exact=${encodeURIComponent(name)}`,
    );
    if (!sourceResponse.ok) {
      return NextResponse.json(
        { error: "The selected card could not be analyzed." },
        { status: 404 },
      );
    }

    const source = (await sourceResponse.json()) as ScryfallCard;
    const role = classifyRole(source);
    const formatCode = FORMAT_CODE[format] ?? "commander";
    const identity =
      commanderColors.length && (format === "EDH" || format === "Pauper EDH")
        ? ` id<=${commanderColors.join("")}`
        : "";
    const manaWindow = Math.max(0, Number(source.cmc ?? 0) + 2);
    const query = [
      role.query,
      `legal:${formatCode}`,
      `cmc<=${manaWindow}`,
      identity,
      `-!"${source.name.replaceAll('"', '\\"')}"`,
      "-is:digital",
    ]
      .filter(Boolean)
      .join(" ");
    const searchResponse = await scryfall(
      `/cards/search?${new URLSearchParams({
        q: query,
        unique: "cards",
        order: "edhrec",
        dir: "asc",
      }).toString()}`,
    );

    if (!searchResponse.ok) {
      return NextResponse.json({
        role,
        source: normalize(source),
        recommendations: [],
      });
    }

    const payload = (await searchResponse.json()) as { data?: ScryfallCard[] };
    const recommendations = (payload.data ?? [])
      .map((candidate) => ({
        ...normalize(candidate),
        score: similarityScore(source, candidate, role),
        reason: buildReason(source, candidate, role),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    return NextResponse.json({
      role,
      source: normalize(source),
      recommendations,
    });
  } catch (error) {
    console.error("Replacement finder error", error);
    return NextResponse.json(
      { error: "Replacement suggestions are temporarily unavailable." },
      { status: 500 },
    );
  }
}

function classifyRole(card: ScryfallCard): CardRole {
  const text = oracleText(card).toLowerCase();
  const type = (card.type_line ?? "").toLowerCase();
  const rules: Array<[RegExp, CardRole]> = [
    [/\bdestroy target\b|\bexile target\b|deals? \d+ damage to any target/, role("Targeted removal", "Removes a specific opposing permanent or threat.", "(o:\"destroy target\" OR o:\"exile target\" OR o:\"damage to any target\")", ["removal", "interaction"])],
    [/counter target spell/, role("Countermagic", "Stops an opposing spell before it resolves.", 'o:"counter target spell"', ["counter", "interaction"])],
    [/draw (?:a|one|two|three|\w+) cards?|investigate|surveil/, role("Card advantage", "Finds or draws additional cards to keep resources flowing.", '(o:"draw" OR o:investigate OR o:surveil)', ["draw", "selection"])],
    [/add \{[wubrgc]\}|treasure token|search your library for (?:a|an) .*land/, role("Mana acceleration", "Produces extra mana or advances land development.", '(o:"add {" OR o:"Treasure token" OR o:"search your library" t:land)', ["ramp", "mana"])],
    [/create .* token|tokens? onto the battlefield/, role("Token production", "Builds board presence by creating creature or utility tokens.", 'o:create o:token', ["tokens", "board presence"])],
    [/return target.*from your graveyard|return .* card from your graveyard/, role("Recursion", "Recovers cards from the graveyard for additional value.", 'o:"from your graveyard" o:return', ["recursion", "value"])],
    [/destroy all|exile all|each creature gets -/, role("Board wipe", "Resets multiple opposing permanents at once.", '(o:"destroy all" OR o:"exile all" OR o:"each creature gets -")', ["sweeper", "control"])],
    [/you gain life|lifelink/, role("Life gain", "Raises your life total or rewards a life-gain strategy.", '(o:"you gain" OR kw:lifelink)', ["life gain", "stabilization"])],
    [/equipment|equip \{|aura/, role("Voltron support", "Enhances or protects a key creature.", '(t:equipment OR t:aura)', ["enhancement", "protection"])],
  ];

  for (const [pattern, result] of rules) {
    if (pattern.test(`${type} ${text}`)) return result;
  }
  if (type.includes("land")) return role("Mana base", "Provides mana or utility from a land slot.", "t:land", ["land", "mana"]);
  if (type.includes("creature")) return role("Creature threat", "Adds a creature with a similar place on the mana curve.", "t:creature", ["creature", "threat"]);
  return role(primaryType(card), `Fills a similar ${primaryType(card).toLowerCase()} slot.`, `t:${primaryType(card).toLowerCase()}`, ["same card type"]);
}

function role(label: string, explanation: string, query: string, signals: string[]): CardRole {
  return { label, explanation, query, signals };
}

function primaryType(card: ScryfallCard) {
  return ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land"]
    .find((type) => card.type_line?.includes(type)) ?? "Permanent";
}

function oracleText(card: ScryfallCard) {
  return card.oracle_text ?? card.card_faces?.map((face) => face.oracle_text ?? "").join(" ") ?? "";
}

function similarityScore(source: ScryfallCard, candidate: ScryfallCard, role: CardRole) {
  let score = 70;
  const sourceTypes = new Set((source.type_line ?? "").split(/\s+|—/).filter(Boolean));
  const candidateTypes = new Set((candidate.type_line ?? "").split(/\s+|—/).filter(Boolean));
  score += [...sourceTypes].filter((type) => candidateTypes.has(type)).length * 4;
  score -= Math.abs(Number(source.cmc ?? 0) - Number(candidate.cmc ?? 0)) * 6;
  const candidateText = oracleText(candidate).toLowerCase();
  score += role.signals.filter((signal) => candidateText.includes(signal)).length * 3;
  return Math.max(1, Math.min(99, Math.round(score)));
}

function buildReason(source: ScryfallCard, candidate: ScryfallCard, role: CardRole) {
  const difference = Number(candidate.cmc ?? 0) - Number(source.cmc ?? 0);
  const curve =
    difference === 0 ? "the same mana value" : difference < 0 ? `${Math.abs(difference)} less mana` : `${difference} more mana`;
  return `Fills the ${role.label.toLowerCase()} role at ${curve}.`;
}

function normalize(card: ScryfallCard) {
  const face = card.card_faces?.find((entry) => entry.image_uris) ?? card;
  return {
    id: card.id,
    name: card.name,
    manaValue: Number(card.cmc ?? 0),
    colors: card.colors ?? [],
    colorIdentity: card.color_identity ?? [],
    typeLine: card.type_line ?? "",
    setCode: card.set ?? "",
    setName: card.set_name ?? "",
    collectorNumber: card.collector_number ?? "",
    image: face.image_uris?.normal ?? face.image_uris?.large ?? "",
    artCrop: face.image_uris?.art_crop ?? face.image_uris?.normal ?? "",
    price: Number(card.prices?.usd ?? card.prices?.usd_foil ?? 0),
    gameChanger: Boolean(card.game_changer),
  };
}

function scryfall(path: string) {
  return fetch(`https://api.scryfall.com${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TradingDocks-DeckVault/2.0",
    },
    next: { revalidate: 300 },
  });
}
