import {
  NextRequest,
  NextResponse,
} from "next/server";

type InputCard = {
  id: string;
  name: string;
  quantity: number;
  manaValue: number;
  colors: string[];
  typeLine: string;
  category: string;
  price: number;
  board?: string;
};

type EnrichedCard = InputCard & {
  oracleText: string;
  colorIdentity: string[];
  legalities: Record<string, string>;
  image?: string;
};

type Issue = {
  role: string;
  severity: "high" | "medium" | "low";
  current: number;
  target: string;
  explanation: string;
  query: string;
};

type Candidate = {
  cardName: string;
  image?: string;
  price?: number;
  role: string;
  issue: string;
  reason: string;
  confidence: number;
  replacement?: string;
  scryfallUri?: string;
  colorIdentity: string[];
  legality: string;
  synergySignals: string[];
};

type DeckIdentity = {
  archetype: string;
  subarchetypes: string[];
  gamePlan: string;
  winMethod: string;
  winConditions: string[];
  confidence: number;
  evidence: string[];
  searchQueries: string[];
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cards = Array.isArray(body.cards)
      ? (body.cards as InputCard[])
      : [];
    const format = String(body.format ?? "EDH");
    const commanderName = String(
      body.commanderName ?? "",
    );
    const submittedDeckColors = normalizeColors(body.deckColors);

    const enrichedDeck = await enrichCards(cards);
    const taggedCommander = enrichedDeck.find(
      (card) =>
        card.board === "commander" ||
        card.category === "Commander",
    );
    const enrichedCommander = taggedCommander ??
      (commanderName ? await fetchCardByExactName(commanderName) : undefined);
    const mainDeck = cards.filter(
      (card) =>
        card.board !== "commander" &&
        card.category !== "Commander",
    );

    const enriched = enrichedDeck.filter(
      (card) =>
        card.board !== "commander" &&
        card.category !== "Commander",
    );
    const commanderIdentity = normalizeColors(enrichedCommander?.colorIdentity);
    const inferredDeckColors = normalizeColors(
      enriched.flatMap((card) => card.colorIdentity),
    );
    const allowedColors = isCommanderFormat(format)
      ? (commanderIdentity.length ? commanderIdentity : submittedDeckColors)
      : (submittedDeckColors.length ? submittedDeckColors : inferredDeckColors);

    const profile = buildProfile(enriched);
    const deckIdentity = analyzeDeckIdentity(enriched, enrichedCommander, format);
    const issues = detectIssues(
      profile,
      format,
      mainDeck.reduce(
        (sum, card) => sum + card.quantity,
        0,
      ),
    );

    const recommendationIssues = issues.length
      ? issues
      : buildUpgradeOpportunities(profile, enriched, enrichedCommander);
    const recommendations = await findCandidates({
      issues: recommendationIssues,
      format,
      commanderIdentity: allowedColors,
      currentNames: new Set(
        cards.map((card) => card.name.toLowerCase()),
      ),
      enriched,
      commander: enrichedCommander,
      deckIdentity,
    });

    const strengths = buildStrengths(profile);
    const rulesSummary = buildSummary(
      profile,
      issues,
      format,
      commanderName,
    );
    const score = calculateScore(
      issues,
      profile,
      format,
    );

    const aiResult = await refineWithAI({
      format,
      commanderName,
      profile,
      issues,
      strengths,
      candidates: recommendations,
      currentDeck: enriched.map((card) => ({
        name: card.name,
        quantity: card.quantity,
        category: card.category,
        manaValue: card.manaValue,
        typeLine: card.typeLine,
        oracleText: card.oracleText,
      })),
      deckIdentity,
    });

    const rankedRecommendations = aiResult?.recommendations?.length
      ? mergeAiRanking(recommendations, aiResult.recommendations)
      : recommendations;
    const finalRecommendations = rankedRecommendations.filter((candidate) =>
      candidatePassesFinalGate(candidate, legalityCode(format), allowedColors),
    );

    return NextResponse.json({
      score,
      summary:
        aiResult?.summary ?? rulesSummary,
      strengths:
        aiResult?.strengths ?? strengths,
      issues,
      recommendations: finalRecommendations,
      analysisMode: aiResult ? "ai" : "rules",
      deckIdentity,
      methodology: {
        cardData: "Scryfall",
        legalityChecked: true,
        colorIdentityChecked:
          format === "EDH" ||
          format === "Pauper EDH",
        finalCandidateValidation: true,
        allowedColors,
        deckArchetypes: [deckIdentity.archetype, ...deckIdentity.subarchetypes],
        ranking:
          "Deck role, commander and deck-theme synergy, curve fit, then EDHREC popularity",
        aiUsed: Boolean(aiResult),
      },
    });
  } catch (error) {
    console.error("Deck Doctor error", error);
    return NextResponse.json(
      {
        error:
          "Deck Doctor could not complete the analysis.",
      },
      { status: 500 },
    );
  }
}

function normalizeColors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .map((color) => String(color).toUpperCase())
    .filter((color) => ["W", "U", "B", "R", "G"].includes(color))));
}

function isCommanderFormat(format: string) {
  return format === "EDH" || format === "Pauper EDH";
}

async function fetchCardByExactName(name: string): Promise<EnrichedCard | undefined> {
  const response = await fetch(
    `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`,
    {
      headers: { Accept: "application/json", "User-Agent": "TradingDocks-DeckDoctor/1.0" },
      next: { revalidate: 86400 },
    },
  );
  if (!response.ok) return undefined;
  const card = await response.json();
  const face = card.card_faces?.find((entry: any) => entry.oracle_text) ?? card;
  return {
    id: card.id, name: card.name, quantity: 1, manaValue: Number(card.cmc ?? 0),
    colors: card.colors ?? [], typeLine: card.type_line ?? "", category: "Commander",
    price: Number(card.prices?.usd ?? 0), board: "commander",
    oracleText: face.oracle_text ?? card.oracle_text ?? "",
    colorIdentity: card.color_identity ?? [], legalities: card.legalities ?? {},
    image: face.image_uris?.normal ?? card.image_uris?.normal ?? "",
  };
}

async function enrichCards(
  cards: InputCard[],
): Promise<EnrichedCard[]> {
  const chunks: InputCard[][] = [];

  for (let index = 0; index < cards.length; index += 75) {
    chunks.push(cards.slice(index, index + 75));
  }

  const enrichedById = new Map<string, any>();
  const enrichedByName = new Map<string, any>();

  for (const chunk of chunks) {
    const response = await fetch(
      "https://api.scryfall.com/cards/collection",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent":
            "TradingDocks-DeckDoctor/1.0",
        },
        body: JSON.stringify({
          identifiers: chunk.map((card) =>
            /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(card.id)
              ? { id: card.id }
              : { name: card.name },
          ),
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) continue;

    const payload = await response.json();
    for (const card of payload.data ?? []) {
      enrichedById.set(card.id, card);
      enrichedByName.set(String(card.name).toLowerCase(), card);
    }
  }

  return cards.map((card) => {
    const scryfall =
      enrichedById.get(card.id) ??
      enrichedByName.get(card.name.toLowerCase());
    const face =
      scryfall?.card_faces?.find(
        (entry: any) => entry.oracle_text,
      ) ?? scryfall;

    return {
      ...card,
      oracleText:
        face?.oracle_text ??
        scryfall?.oracle_text ??
        "",
      colorIdentity:
        scryfall?.color_identity ??
        card.colors ??
        [],
      legalities: scryfall?.legalities ?? {},
      image:
        face?.image_uris?.normal ??
        scryfall?.image_uris?.normal ??
        (card as InputCard & { image?: string }).image ??
        "",
    };
  });
}

function buildProfile(cards: EnrichedCard[]) {
  const total = cards.reduce(
    (sum, card) => sum + card.quantity,
    0,
  );

  const count = (
    predicate: (card: EnrichedCard) => boolean,
  ) =>
    cards.reduce(
      (sum, card) =>
        sum +
        (predicate(card) ? card.quantity : 0),
      0,
    );

  const oracle = (card: EnrichedCard) =>
    card.oracleText.toLowerCase();
  const category = (card: EnrichedCard) =>
    card.category.toLowerCase();

  const lands = count((card) =>
    card.typeLine.includes("Land"),
  );
  const ramp = count(
    (card) =>
      category(card).includes("ramp") ||
      /\badd \{[wubrgc]\}|search your library for (a|up to \w+) land|treasure token|costs? \{1\} less/.test(
        oracle(card),
      ),
  );
  const draw = count(
    (card) =>
      category(card).includes("draw") ||
      /\bdraw (a|two|three|x|\d+) cards?\b|whenever .* draw|at the beginning of .* draw/.test(
        oracle(card),
      ),
  );
  const removal = count(
    (card) =>
      category(card).includes("removal") ||
      /\bdestroy target\b|\bexile target\b|return target .* to its owner's hand|target .* gets -\d+\/-\d+/.test(
        oracle(card),
      ),
  );
  const boardWipes = count(
    (card) =>
      category(card).includes("board wipe") ||
      /destroy all|exile all|each creature gets -\d+\/-\d+|all creatures get -\d+\/-\d+/.test(
        oracle(card),
      ),
  );
  const protection = count(
    (card) =>
      category(card).includes("protection") ||
      /hexproof|indestructible|phase out|protection from|counter target spell that targets/.test(
        oracle(card),
      ),
  );
  const tutors = count(
    (card) =>
      category(card).includes("tutor") ||
      /search your library for (a|an|up to one) (card|creature|artifact|enchantment|instant|sorcery)/.test(
        oracle(card),
      ),
  );
  const finishers = count(
    (card) =>
      category(card).includes("win") ||
      category(card).includes("finisher") ||
      /you win the game|each opponent loses|combat damage to a player.*double|extra turn|creatures you control get \+\d+\/\+\d+/.test(
        oracle(card),
      ),
  );
  const comboPieces = count(
    (card) =>
      category(card).includes("combo") ||
      /untap target|whenever .* untap|copy target activated|you may cast .* without paying|additional combat phase/.test(
        oracle(card),
      ),
  );

  const nonlands = cards.filter(
    (card) => !card.typeLine.includes("Land"),
  );
  const averageManaValue =
    nonlands.length > 0
      ? nonlands.reduce(
          (sum, card) =>
            sum +
            card.manaValue * card.quantity,
          0,
        ) /
        Math.max(
          1,
          nonlands.reduce(
            (sum, card) => sum + card.quantity,
            0,
          ),
        )
      : 0;

  return {
    total,
    lands,
    ramp,
    draw,
    removal,
    boardWipes,
    protection,
    tutors,
    finishers,
    comboPieces,
    averageManaValue,
  };
}

function detectIssues(
  profile: ReturnType<typeof buildProfile>,
  format: string,
  totalCards: number,
): Issue[] {
  const commander =
    format === "EDH" || format === "Pauper EDH";
  const scale = commander
    ? 1
    : Math.max(0.6, totalCards / 100);

  const targets = commander
    ? {
        lands: [35, 39],
        ramp: [9, 13],
        draw: [9, 13],
        removal: [8, 12],
        boardWipes: [2, 4],
        protection: [2, 5],
        finishers: [2, 5],
      }
    : {
        lands: [22, 26],
        ramp: [0, 6],
        draw: [5, 10],
        removal: [5, 10],
        boardWipes: [0, 3],
        protection: [0, 4],
        finishers: [2, 6],
      };

  const issues: Issue[] = [];
  const add = (
    role: string,
    current: number,
    target: [number, number],
    explanation: string,
    query: string,
  ) => {
    const minimum = Math.round(target[0] * scale);
    const maximum = Math.max(
      minimum,
      Math.round(target[1] * scale),
    );
    if (current >= minimum) return;

    const gap = minimum - current;
    issues.push({
      role,
      current,
      target: `${minimum}–${maximum}`,
      severity:
        gap >= 4
          ? "high"
          : gap >= 2
            ? "medium"
            : "low",
      explanation,
      query,
    });
  };

  add(
    "Card Draw",
    profile.draw,
    targets.draw as [number, number],
    "The deck may run out of resources before it can rebuild or close the game.",
    '(o:"draw a card" or o:"draw two cards" or o:"draw three cards")',
  );
  add(
    "Ramp",
    profile.ramp,
    targets.ramp as [number, number],
    "Additional acceleration would improve sequencing and help the deck deploy its key spells sooner.",
    '(o:"add {" or o:"search your library for a basic land" or o:"Treasure token")',
  );
  add(
    "Interaction",
    profile.removal,
    targets.removal as [number, number],
    "The deck may struggle to answer opposing engines, commanders, or must-remove permanents.",
    '(o:"destroy target" or o:"exile target" or o:"counter target spell")',
  );
  add(
    "Board Wipes",
    profile.boardWipes,
    targets.boardWipes as [number, number],
    "A small number of reset effects helps recover from opponents developing faster boards.",
    '(o:"destroy all creatures" or o:"exile all creatures" or o:"each creature gets -")',
  );
  add(
    "Protection",
    profile.protection,
    targets.protection as [number, number],
    "The deck has limited ways to protect its commander, combo, or established board.",
    '(o:hexproof or o:indestructible or o:"phase out")',
  );
  add(
    "Game Enders",
    profile.finishers,
    targets.finishers as [number, number],
    "The deck appears light on cards that convert an advantage into a decisive win.",
    '(o:"you win the game" or o:"each opponent loses" or o:"extra combat phase" or o:"extra turn")',
  );

  if (
    profile.comboPieces > 0 &&
    profile.comboPieces < 3
  ) {
    issues.push({
      role: "Combo Support",
      severity: "medium",
      current: profile.comboPieces,
      target: "2–4 redundant pieces",
      explanation:
        "The list appears to contain a combo line, but limited redundancy may make it inconsistent or easy to disrupt.",
      query:
        '(o:"untap target" or o:"copy target activated ability" or o:"you may cast" or o:"without paying its mana cost")',
    });
  }

  if (
    profile.averageManaValue > 4 &&
    profile.ramp < targets.ramp[0]
  ) {
    issues.unshift({
      role: "Mana Efficiency",
      severity: "high",
      current: Number(
        profile.averageManaValue.toFixed(2),
      ),
      target: "≤ 3.75 or more ramp",
      explanation:
        "The average mana value is high relative to the available acceleration.",
      query:
        '(cmc<=2 and (o:"add {" or o:"search your library for a basic land"))',
    });
  }

  return issues.slice(0, 6);
}

function buildUpgradeOpportunities(
  profile: ReturnType<typeof buildProfile>,
  cards: EnrichedCard[],
  commander?: EnrichedCard,
): Issue[] {
  const primaryTheme = buildThemeSignals(cards, commander)[0]?.[0];
  const themeQuery: Record<string, string> = {
    tokens: '(o:"create" and o:"token")',
    artifacts: '(t:artifact or o:"artifact")',
    enchantments: '(t:enchantment or o:"enchantment")',
    graveyard: '(o:"graveyard" or o:"return target" o:"from your graveyard")',
    spellslinger: '(o:"instant or sorcery" or o:"noncreature spell" or o:"copy target spell")',
    counters: '(o:"+1/+1 counter" or o:proliferate)',
    lifegain: '(o:"gain life" or o:lifelink)',
    sacrifice: '(o:sacrifice or o:"when" o:"dies")',
    lands: '(o:landfall or o:"additional land")',
    typal: '(o:"creatures you control" or o:"choose a creature type")',
  };

  return [
    {
      role: primaryTheme ? `${primaryTheme[0].toUpperCase()}${primaryTheme.slice(1)} Synergy` : "Strategy Synergy",
      severity: "low",
      current: 0,
      target: "Focused upgrades",
      explanation: "The deck meets its baseline structure, so these suggestions focus on cards that reinforce its established game plan.",
      query: themeQuery[primaryTheme ?? ""] ?? '(-t:land and cmc<=4)',
    },
    {
      role: "Flexible Value",
      severity: "low",
      current: Math.round(profile.averageManaValue * 100) / 100,
      target: "Efficient, multi-purpose cards",
      explanation: "Flexible cards improve consistency without pulling the deck away from its primary strategy.",
      query: '(-t:land and cmc<=4 and (o:"draw a card" or o:"exile target" or o:"create a Treasure token"))',
    },
  ];
}

async function findCandidates({
  issues,
  format,
  commanderIdentity,
  currentNames,
  enriched,
  commander,
  deckIdentity,
}: {
  issues: Issue[];
  format: string;
  commanderIdentity: string[];
  currentNames: Set<string>;
  enriched: EnrichedCard[];
  commander?: EnrichedCard;
  deckIdentity: DeckIdentity;
}): Promise<Candidate[]> {
  const results: Candidate[] = [];
  const legality = legalityCode(format);
  const commanderFormat =
    format === "EDH" || format === "Pauper EDH";
  const identity = commanderIdentity.length > 0
    ? ` id<=${commanderIdentity.join("").toLowerCase()}`
    : " id:c";
  const themeSignals = buildThemeSignals(enriched, commander);
  const lowestImpact = [...enriched]
    .filter(
      (card) =>
        !card.typeLine.includes("Land") &&
        card.category !== "Commander",
    )
    .sort(
      (a, b) =>
        b.manaValue - a.manaValue ||
        a.price - b.price,
    );

  for (const issue of issues.slice(0, 5)) {
    const query = `${issue.query}${identity} legal:${legality} -is:digital`;
    const params = new URLSearchParams({
      q: query,
      unique: "cards",
      order:
        format === "EDH" ||
        format === "Pauper EDH"
          ? "edhrec"
          : "released",
      dir: "asc",
    });

    const response = await fetch(
      `https://api.scryfall.com/cards/search?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "TradingDocks-DeckDoctor/1.0",
        },
        next: { revalidate: 1800 },
      },
    );

    if (!response.ok) continue;

    const payload = await response.json();
    const candidates = (payload.data ?? [])
      .filter(
        (card: any) =>
          !currentNames.has(String(card.name).toLowerCase()) &&
          isCandidateLegal(card, legality, commanderIdentity, commanderFormat),
      )
      .map((card: any) => ({
        card,
        synergy: scoreThemeSynergy(card, themeSignals, commander),
      }))
      .sort((a: any, b: any) => b.synergy.score - a.synergy.score)
      .slice(0, 5);

    for (const [index, entry] of candidates.entries()) {
      const { card, synergy } = entry;
      const face =
        card.card_faces?.find(
          (entry: any) => entry.image_uris,
        ) ?? card;
      const price = Number(
        card.prices?.usd ??
          card.prices?.usd_foil ??
          0,
      );

      results.push({
        cardName: card.name,
        image:
          face.image_uris?.normal ??
          face.image_uris?.large ??
          "",
        price,
        role: issue.role,
        issue: issue.role,
        reason: candidateReason(
          card,
          issue,
          format,
        ),
        confidence: Math.max(
          72,
          Math.min(98, 86 - index * 4 + synergy.score),
        ),
        replacement:
          lowestImpact[index]?.name,
        scryfallUri: card.scryfall_uri,
        colorIdentity: card.color_identity ?? [],
        legality: card.legalities?.[legality] ?? "not_legal",
        synergySignals: synergy.signals,
      });
    }
  }

  // Run a dedicated plan-aware search in addition to generic role searches.
  // EDHREC popularity is useful as a tiebreaker, but plan fit comes first.
  for (const strategyQuery of deckIdentity.searchQueries.slice(0, 3)) {
    const query = `${strategyQuery}${identity} legal:${legality} -is:digital`;
    const params = new URLSearchParams({ q: query, unique: "cards", order: commanderFormat ? "edhrec" : "released", dir: "asc" });
    const response = await fetch(`https://api.scryfall.com/cards/search?${params.toString()}`, {
      headers: { Accept: "application/json", "User-Agent": "TradingDocks-DeckDoctor/1.0" },
      next: { revalidate: 1800 },
    });
    if (!response.ok) continue;
    const payload = await response.json();
    const strategyCards = (payload.data ?? [])
      .filter((card: any) => !currentNames.has(String(card.name).toLowerCase()) && isCandidateLegal(card, legality, commanderIdentity, commanderFormat))
      .map((card: any) => ({ card, synergy: scoreThemeSynergy(card, themeSignals, commander) }))
      .sort((a: any, b: any) => b.synergy.score - a.synergy.score)
      .slice(0, 4);
    for (const [index, entry] of strategyCards.entries()) {
      const { card, synergy } = entry;
      const face = card.card_faces?.find((item: any) => item.image_uris) ?? card;
      results.push({
        cardName: card.name,
        image: face.image_uris?.normal ?? face.image_uris?.large ?? "",
        price: Number(card.prices?.usd ?? card.prices?.usd_foil ?? 0),
        role: "Win Plan Support",
        issue: deckIdentity.winMethod,
        reason: `${card.oracle_text ?? face.oracle_text ?? "This card supports the primary game plan."} This advances the diagnosed ${deckIdentity.archetype} plan: ${deckIdentity.winMethod.toLowerCase()}.`,
        confidence: Math.max(76, Math.min(98, deckIdentity.confidence - index + synergy.score)),
        replacement: lowestImpact[index]?.name,
        scryfallUri: card.scryfall_uri,
        colorIdentity: card.color_identity ?? [],
        legality: card.legalities?.[legality] ?? "not_legal",
        synergySignals: Array.from(new Set([deckIdentity.archetype, ...synergy.signals])).slice(0, 3),
      });
    }
  }

  // A complete list can satisfy every fixed ratio, and narrow Oracle-text searches
  // occasionally return no cards. Always provide a useful second pass drawn from
  // legal, in-identity, paper cards, then rank it by the deck's detected themes.
  if (results.length < 5) {
    const fallbackQuery = `-t:basic -is:digital${identity} legal:${legality}`;
    const params = new URLSearchParams({
      q: fallbackQuery,
      unique: "cards",
      order: commanderFormat ? "edhrec" : "released",
      dir: "asc",
    });
    const response = await fetch(
      `https://api.scryfall.com/cards/search?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "TradingDocks-DeckDoctor/1.0",
        },
        next: { revalidate: 1800 },
      },
    );

    if (response.ok) {
      const payload = await response.json();
      const fallbackIssue = issues[0] ?? {
        role: "Strategy Synergy",
        explanation: "Reinforces the deck's established plan.",
      };
      const fallback = (payload.data ?? [])
        .filter(
          (card: any) =>
            !currentNames.has(String(card.name).toLowerCase()) &&
            isCandidateLegal(card, legality, commanderIdentity, commanderFormat),
        )
        .map((card: any) => ({
          card,
          synergy: scoreThemeSynergy(card, themeSignals, commander),
        }))
        .sort((a: any, b: any) => b.synergy.score - a.synergy.score)
        .slice(0, 12);

      for (const [index, entry] of fallback.entries()) {
        const { card, synergy } = entry;
        const face = card.card_faces?.find((item: any) => item.image_uris) ?? card;
        results.push({
          cardName: card.name,
          image: face.image_uris?.normal ?? face.image_uris?.large ?? "",
          price: Number(card.prices?.usd ?? card.prices?.usd_foil ?? 0),
          role: fallbackIssue.role,
          issue: fallbackIssue.role,
          reason: `${card.oracle_text ?? face.oracle_text ?? "This card provides efficient, format-legal value."} It matches the deck's verified colors and supports its detected strategy.`,
          confidence: Math.max(70, Math.min(94, 78 - index + synergy.score)),
          replacement: lowestImpact[index]?.name,
          scryfallUri: card.scryfall_uri,
          colorIdentity: card.color_identity ?? [],
          legality: card.legalities?.[legality] ?? "not_legal",
          synergySignals: synergy.signals,
        });
      }
    }
  }

  const seen = new Set<string>();
  return results
    .filter((candidate) => {
      const key =
        candidate.cardName.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function isCandidateLegal(
  card: any,
  legality: string,
  commanderIdentity: string[],
  _commanderFormat: boolean,
) {
  if (card.legalities?.[legality] !== "legal") return false;
  if (!commanderIdentity.length) return (card.color_identity ?? []).length === 0;
  const allowed = new Set(commanderIdentity);
  return (card.color_identity ?? []).every((color: string) =>
    allowed.has(color),
  );
}

function candidatePassesFinalGate(
  candidate: Candidate,
  legality: string,
  allowedColors: string[],
) {
  if (candidate.legality !== "legal") return false;
  const allowed = new Set(allowedColors);
  return candidate.colorIdentity.every((color) => allowed.has(color));
}

function analyzeDeckIdentity(cards: EnrichedCard[], commander: EnrichedCard | undefined, format: string): DeckIdentity {
  const quantity = (pattern: RegExp) => cards.reduce((sum, card) =>
    sum + (pattern.test(`${card.typeLine} ${card.oracleText}`.toLowerCase()) ? card.quantity : 0), 0);
  const themes = [
    ["Alternate Win Conditions", /you win the game|loses the game/, '(o:"you win the game" or o:"loses the game")'],
    ["Aristocrats", /sacrifice|when .* dies|whenever .* dies/, '(o:sacrifice and (o:dies or o:"each opponent loses"))'],
    ["Artifacts", /artifact|treasure|equipment|vehicle/, '(t:artifact or o:"artifact")'],
    ["Blink / Flicker", /exile .* return|enters the battlefield|enters,/, '(o:"exile" and o:"return" and (o:"battlefield" or o:"owner’s control"))'],
    ["Burn", /deals? \d+ damage|damage to each opponent/, '(o:"damage to each opponent" or o:"any target")'],
    ["Cascade", /cascade|discover \d|discover x/, '(o:cascade or o:discover)'],
    ["Clones", /copy of target|enters as a copy|copy target permanent/, '(o:"copy of" or o:"enters as a copy")'],
    ["Counters Matter", /\+1\/\+1 counter|-1\/-1 counter|proliferate|counter on/, '(o:"+1/+1 counter" or o:proliferate or o:"counter on")'],
    ["Cycling", /cycling|whenever you cycle|cycle or discard/, '(o:cycling or o:"whenever you cycle")'],
    ["Discard", /opponent discards|each player discards|discard a card/, '(o:"opponent discards" or o:"each player discards")'],
    ["Draw-Go / Permission", /counter target spell|flash|untap during each other player/, '(o:"counter target spell" or kw:flash)'],
    ["Enchantress", /enchantment|constellation|whenever you cast an enchantment/, '(t:enchantment or o:"cast an enchantment")'],
    ["Extra Combat / Turns", /additional combat phase|extra turn/, '(o:"additional combat phase" or o:"extra turn")'],
    ["Hate Bears", /players can’t|opponents can’t|spells your opponents cast cost/, '(t:creature and (o:"can’t" or o:"cost {1} more"))'],
    ["Infect", /infect|poison counter|toxic \d/, '(o:infect or o:"poison counter" or o:toxic)'],
    ["Judo / Theft", /gain control of|copy target spell|change the target|redirect/, '(o:"gain control of" or o:"change the target" or o:"copy target spell")'],
    ["Land Destruction", /destroy target land|lands don’t untap|sacrifice a land/, '(o:"destroy target land" or o:"lands don’t untap")'],
    ["Lands Matter", /landfall|play an additional land|land enters/, '(o:landfall or o:"additional land")'],
    ["Life Drain", /each opponent loses|loses that much life/, '(o:"each opponent loses" or o:"loses that much life")'],
    ["Life Gain", /gain life|lifelink|life total/, '(o:"gain life" or o:lifelink)'],
    ["Mill / Self Mill", /mills? \d|mill cards|put .* library into .* graveyard/, '(o:mill or (o:library and o:graveyard))'],
    ["Top-Deck Matters", /top card of your library|from the top of your library|miracle/, '(o:"top card of your library" or o:miracle)'],
    ["One-Shot Kills", /double strike|double .* power|infect|commander damage/, '(o:"double strike" or o:"double" o:power or o:infect)'],
    ["Overrun / Swarm", /creatures you control get \+|trample until end of turn/, '(o:"creatures you control get" and (o:trample or o:"until end of turn"))'],
    ["Pillow Fort", /can’t attack you|unless their controller pays|prevent all combat damage/, '(o:"can’t attack you" or o:"prevent all combat damage")'],
    ["Reanimator", /return target .* from your graveyard to the battlefield|reanimate/, '(o:"from your graveyard to the battlefield" or o:reanimate)'],
    ["Sneak and Tell", /without paying|put .* onto the battlefield|rather than pay/, '(o:"without paying" or o:"onto the battlefield" or o:"rather than pay")'],
    ["Spellslinger", /instant or sorcery|noncreature spell|magecraft|copy .* spell/, '(o:"instant or sorcery" or o:magecraft or o:"copy target spell")'],
    ["Storm", /storm|whenever you cast|spells you’ve cast this turn/, '(o:storm or o:"spells you’ve cast this turn")'],
    ["Superfriends", /planeswalker|loyalty ability|loyalty counters/, '(t:planeswalker or o:"loyalty ability")'],
    ["Taxes", /costs? \{1\} more|unless .* pays? \{|additional cost/, '(o:"cost {1} more" or o:"unless" o:"pays")'],
    ["Tokens", /create .* token|creature tokens?/, '(o:"create" and o:token)'],
    ["Toolbox / Tutors", /search your library for a card|search your library for a creature|tutor/, '(o:"search your library" and -o:"basic land")'],
    ["Typal Creatures", /choose a creature type|creatures you control of the chosen type/, '(o:"choose a creature type" or o:"creature type")'],
    ["Tribal+", /historic|legendary spell|face-down|morph|defender/, '(o:historic or o:"legendary spell" or o:morph or o:defender)'],
    ["Voltron", /equipment|aura attached|equipped creature|commander .* gets/, '(t:equipment or t:aura or o:"equipped creature")'],
    ["Wheels", /each player discards their hand|shuffle their hand|draws? seven cards/, '(o:"each player discards" or o:"draws seven cards")'],
    ["XY Monsters", /double .* power|power equal to|base power and toughness/, '(o:"double" o:power or o:"power equal to")'],
  ] as const;
  const rankedThemes = themes.map(([name, pattern, query]) => ({ name, score: quantity(pattern), query })).filter((item) => item.score >= 2).sort((a, b) => b.score - a.score);
  const interaction = quantity(/counter target spell|destroy target|exile target|return target .* hand/);
  const denial = quantity(/players can’t|opponents can’t|doesn’t untap|costs? \{1\} more|can’t attack/);
  const fastPressure = quantity(/haste|double strike|creatures you control get \+|whenever .* attacks/);
  const generosity = quantity(/each player draws|each player may|opponent creates|another player/);
  const chaos = quantity(/at random|coin flip|randomly|exchange control|choose .* at random/);
  const combo = quantity(/untap target|copy target activated|without paying|additional combat phase|you win the game/);
  const archetypes = [
    { name: "Combo", score: combo * 3 + (rankedThemes.some((item) => item.name === "Storm") ? 8 : 0) },
    { name: "Control", score: interaction * 2 + quantity(/board wipe|destroy all|exile all/) * 3 },
    { name: "Stax / Prison", score: denial * 3 },
    { name: "Aggro", score: fastPressure * 2 + quantity(/mana value 1|mana value 2/) },
    { name: "Group Hug", score: generosity * 2 - quantity(/each opponent loses|damage to each opponent/) },
    { name: "False Hug / Group Slug", score: generosity + quantity(/each opponent loses|damage to each opponent|whenever an opponent/) * 2 },
    { name: "Chaos", score: chaos * 4 },
    { name: "Good-Stuff / Mid-Range / BattleCruiser", score: 6 + quantity(/draw a card|create a treasure token|enters the battlefield/) },
  ].sort((a, b) => b.score - a.score);
  const selected = archetypes[0];
  const selectedThemes = rankedThemes.slice(0, 4);
  const janky = selectedThemes.length === 0 && cards.some((card) => /chair|contraption|hat|artist|art by/.test(`${card.name} ${card.oracleText}`.toLowerCase()));
  const archetype = janky ? "Weird / Janky Theme" : selected.name;
  const primaryTheme = selectedThemes[0]?.name ?? "Flexible Value";
  const method = describeGamePlan(archetype, selectedThemes.map((item) => item.name));
  const namedWins = cards.filter((card) => /you win the game|each opponent loses|additional combat phase|double strike/.test(card.oracleText.toLowerCase())).slice(0, 3).map((card) => card.name);
  return {
    archetype,
    subarchetypes: selectedThemes.map((item) => item.name),
    gamePlan: method,
    winMethod: method,
    winConditions: Array.from(new Set([...namedWins, ...inferWinConditions(archetype, selectedThemes.map((item) => item.name))])).slice(0, 5),
    confidence: Math.max(62, Math.min(96, 66 + selected.score + (selectedThemes[0]?.score ?? 0))),
    evidence: [commander ? `Commander: ${commander.name}` : `${format} card patterns`, `Primary theme: ${primaryTheme}`, `${selectedThemes.reduce((sum, item) => sum + item.score, 0)} matching theme cards`],
    searchQueries: selectedThemes.slice(0, 3).map((item) => item.query),
  };
}

function describeGamePlan(archetype: string, themes: string[]) {
  const tools = themes.length ? themes.slice(0, 3).join(", ") : "efficient value and resilient threats";
  const posture: Record<string, string> = {
    Aggro: "Apply pressure early and shorten the game",
    Combo: "Assemble a compact game-ending interaction",
    Control: "Trade resources, control the board, and take over the late game",
    "Stax / Prison": "Restrict opposing resources while developing an asymmetric advantage",
    "Group Hug": "Accelerate the table and leverage the extra resources better than opponents",
    "False Hug / Group Slug": "Offer symmetrical resources, then punish opponents for using them",
    Chaos: "Destabilize normal game plans and profit from unpredictable board states",
    "Weird / Janky Theme": "Build around a deliberately unusual mechanical or flavor constraint",
    "Good-Stuff / Mid-Range / BattleCruiser": "Build incremental value and win with resilient, high-impact threats",
  };
  return `${posture[archetype] ?? posture["Good-Stuff / Mid-Range / BattleCruiser"]} using ${tools}.`;
}

function inferWinConditions(archetype: string, themes: string[]) {
  const wins: string[] = [];
  if (themes.some((theme) => /Voltron|One-Shot|Infect|XY Monsters/.test(theme))) wins.push("Commander damage or one-shot combat");
  if (themes.some((theme) => /Tokens|Overrun|Typal/.test(theme))) wins.push("Go-wide combat or overrun effect");
  if (themes.some((theme) => /Aristocrats|Life Drain|Burn/.test(theme))) wins.push("Noncombat damage or life-drain engine");
  if (themes.some((theme) => /Mill/.test(theme))) wins.push("Library depletion");
  if (themes.some((theme) => /Alternate Win/.test(theme))) wins.push("Printed alternate-win condition");
  if (archetype === "Combo" || themes.some((theme) => /Storm|Extra Combat/.test(theme))) wins.push("Deterministic combo or explosive chain turn");
  if (!wins.length) wins.push("Combat damage from accumulated board advantage", "Value-engine inevitability");
  return wins;
}

function detectArchetypes(cards: EnrichedCard[], commander?: EnrichedCard) {
  const themes = buildThemeSignals(cards, commander).map(([label]) => label);
  const creatureTypes = new Map<string, number>();
  for (const card of cards) {
    const subtype = card.typeLine.split("—")[1]?.trim();
    if (!subtype) continue;
    for (const type of subtype.split(/\s+/)) {
      creatureTypes.set(type, (creatureTypes.get(type) ?? 0) + card.quantity);
    }
  }
  const typal = [...creatureTypes.entries()].sort((a, b) => b[1] - a[1])[0];
  const result = [...themes];
  if (typal && typal[1] >= 8) result.unshift(`${typal[0]} typal`);
  return result.length ? result.slice(0, 4) : ["mixed strategy"];
}

function buildThemeSignals(cards: EnrichedCard[], commander?: EnrichedCard) {
  const source = [commander, ...cards]
    .filter(Boolean)
    .map((card) => `${card?.typeLine ?? ""} ${card?.oracleText ?? ""}`.toLowerCase())
    .join(" ");
  const signals: Array<[string, RegExp]> = [
    ["tokens", /create .* token|token enters|creature tokens?/],
    ["artifacts", /artifact|treasure|equipment|vehicle/],
    ["enchantments", /enchantment|aura|constellation/],
    ["graveyard", /graveyard|mill|discard|reanimate/],
    ["spellslinger", /instant or sorcery|noncreature spell|copy .* spell/],
    ["counters", /\+1\/\+1 counter|counter on|proliferate/],
    ["lifegain", /gain life|lifelink|life total/],
    ["sacrifice", /sacrifice|dies|when .* dies/],
    ["lands", /landfall|land enters|play an additional land/],
    ["typal", /choose a creature type|creatures? you control of the chosen type/],
  ];
  return signals.filter(([, pattern]) => pattern.test(source));
}

function scoreThemeSynergy(
  card: any,
  themes: Array<[string, RegExp]>,
  commander?: EnrichedCard,
) {
  const text = `${card.type_line ?? ""} ${card.oracle_text ?? ""} ${card.card_faces?.map((face: any) => face.oracle_text ?? "").join(" ") ?? ""}`.toLowerCase();
  const signals = themes
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label);
  const commanderWords = new Set(
    `${commander?.typeLine ?? ""} ${commander?.oracleText ?? ""}`
      .toLowerCase()
      .match(/[a-z]{5,}/g) ?? [],
  );
  const sharedCommanderTerms = [...commanderWords].filter((word) =>
    text.includes(word),
  ).length;
  return {
    score: Math.min(12, signals.length * 3 + Math.min(3, sharedCommanderTerms)),
    signals: signals.slice(0, 3),
  };
}

function candidateReason(
  card: any,
  issue: Issue,
  format: string,
) {
  const oracle =
    card.oracle_text ??
    card.card_faces
      ?.map((face: any) => face.oracle_text)
      .filter(Boolean)
      .join(" // ") ??
    "";

  const shortOracle =
    oracle.length > 135
      ? `${oracle.slice(0, 132)}…`
      : oracle;

  return `${shortOracle} It is legal in ${format} and directly addresses the detected ${issue.role.toLowerCase()} gap.`;
}

function buildStrengths(
  profile: ReturnType<typeof buildProfile>,
) {
  const strengths: string[] = [];

  if (profile.draw >= 9)
    strengths.push("Healthy card advantage");
  if (profile.ramp >= 9)
    strengths.push("Strong acceleration");
  if (profile.removal >= 8)
    strengths.push("Good interaction density");
  if (profile.boardWipes >= 2)
    strengths.push("Includes reset buttons");
  if (profile.protection >= 2)
    strengths.push("Key-piece protection");
  if (profile.averageManaValue <= 3.5)
    strengths.push("Efficient mana curve");

  return strengths.length
    ? strengths.slice(0, 5)
    : ["Clear opportunities for focused upgrades"];
}

function buildSummary(
  profile: ReturnType<typeof buildProfile>,
  issues: Issue[],
  format: string,
  commanderName: string,
) {
  const focus = issues
    .slice(0, 3)
    .map((issue) => issue.role.toLowerCase())
    .join(", ");

  return `${commanderName ? `${commanderName} currently` : "This deck currently"} has an average mana value of ${profile.averageManaValue.toFixed(2)}. The highest-priority areas for the ${format} list are ${focus || "fine tuning and matchup-specific choices"}. Recommendations are filtered for legality and, where applicable, commander color identity.`;
}

function calculateScore(
  issues: Issue[],
  profile: ReturnType<typeof buildProfile>,
  format: string,
) {
  let score = 92;

  for (const issue of issues) {
    score -=
      issue.severity === "high"
        ? 12
        : issue.severity === "medium"
          ? 7
          : 3;
  }

  if (profile.averageManaValue > 4.5)
    score -= 6;
  if (
    (format === "EDH" ||
      format === "Pauper EDH") &&
    profile.lands < 32
  )
    score -= 8;

  return Math.max(35, Math.min(98, score));
}

function legalityCode(format: string) {
  return {
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
  }[format] ?? "commander";
}

async function refineWithAI(input: {
  format: string;
  commanderName: string;
  profile: any;
  issues: Issue[];
  strengths: string[];
  candidates: Candidate[];
  currentDeck: any[];
  deckIdentity: DeckIdentity;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || input.candidates.length === 0)
    return null;

  const model =
    process.env.OPENAI_DECK_DOCTOR_MODEL ??
    "gpt-5-mini";

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "You are a rigorous professional Magic: The Gathering deck builder. Rank only the supplied legal Scryfall candidates and never invent or add a card. Treat deckIdentity as a hypothesis supported by the submitted list. Prefer cards that advance the primary game plan, strengthen a named win condition, or add needed redundancy; then consider structural role and curve fit; use broad EDHREC popularity only as a tiebreaker. Distinguish deterministic combos, synergy engines, and ordinary value. Never rank a generic staple over a clearly stronger plan-specific card. Return JSON only.",
          },
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "deck_doctor_review",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: {
                  type: "string",
                },
                strengths: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 5,
                },
                recommendations: {
                  type: "array",
                  maxItems: 8,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      cardName: {
                        type: "string",
                      },
                      confidence: {
                        type: "integer",
                        minimum: 1,
                        maximum: 99,
                      },
                      reason: {
                        type: "string",
                      },
                    },
                    required: [
                      "cardName",
                      "confidence",
                      "reason",
                    ],
                  },
                },
              },
              required: [
                "summary",
                "strengths",
                "recommendations",
              ],
            },
          },
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    console.error(
      "OpenAI Deck Doctor refinement failed",
      response.status,
    );
    return null;
  }

  const payload = await response.json();
  const outputText =
    payload.output_text ??
    payload.output
      ?.flatMap((item: any) => item.content ?? [])
      .find((item: any) => item.type === "output_text")
      ?.text;

  if (!outputText) return null;

  try {
    return JSON.parse(outputText);
  } catch {
    return null;
  }
}

function mergeAiRanking(
  source: Candidate[],
  ranking: Array<{
    cardName: string;
    confidence: number;
    reason: string;
  }>,
) {
  const sourceByName = new Map(
    source.map((candidate) => [
      candidate.cardName.toLowerCase(),
      candidate,
    ]),
  );

  const merged = ranking
    .map((ranked) => {
      const original = sourceByName.get(
        ranked.cardName.toLowerCase(),
      );
      if (!original) return null;

      return {
        ...original,
        confidence: ranked.confidence,
        reason: ranked.reason,
      };
    })
    .filter(Boolean) as Candidate[];

  const included = new Set(
    merged.map((item) =>
      item.cardName.toLowerCase(),
    ),
  );

  return [
    ...merged,
    ...source.filter(
      (item) =>
        !included.has(
          item.cardName.toLowerCase(),
        ),
    ),
  ].slice(0, 8);
}
