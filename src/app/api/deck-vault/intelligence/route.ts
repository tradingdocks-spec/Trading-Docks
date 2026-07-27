import {
  NextRequest,
  NextResponse,
} from "next/server";

type InputCard = {
  id: string;
  name: string;
  quantity: number;
  colors: string[];
  board?: string;
  typeLine?: string;
  setCode?: string;
  collectorNumber?: string;
};

type InventoryItem = {
  inventoryId: string;
  name: string;
  quantity: number;
  location: string;
  locationId?: string;
  locationType?: string;
  binderPage?: number;
  binderSlot?: string;
  condition: string;
  printing?: string;
  platform?: string;
  listingId?: string;
  reservedForDeck?: boolean;
};

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

export async function POST(
  request: NextRequest,
) {
  try {
    const body = await request.json();
    const cards = Array.isArray(body.cards)
      ? (body.cards as InputCard[])
      : [];
    const format = String(
      body.format ?? "EDH",
    );
    const inventory = Array.isArray(
      body.inventory,
    )
      ? (body.inventory as InventoryItem[])
      : [];

    const enriched = await enrich(cards);
    const formatCode =
      FORMAT_CODE[format] ?? "commander";

    const commanders = enriched.filter(
      (card) =>
        card.board === "commander",
    );
    const commanderFormat =
      format === "EDH" ||
      format === "Pauper EDH";
    const main = enriched.filter(
      (card) =>
        (!commanderFormat ||
          card.board !== "commander") &&
        card.board !== "sideboard" &&
        card.board !== "maybeboard",
    );

    const issues: Array<{
      cardId?: string;
      cardName?: string;
      severity: "error" | "warning";
      code: string;
      message: string;
    }> = [];

    for (const card of enriched) {
      const legality =
        card.legalities?.[formatCode];

      if (
        legality === "banned" ||
        legality === "not_legal" ||
        legality === "restricted"
      ) {
        issues.push({
          cardId: card.id,
          cardName: card.name,
          severity:
            legality === "restricted"
              ? "warning"
              : "error",
          code: legality,
          message:
            legality === "banned"
              ? `This card is banned in ${format}.`
              : legality === "restricted"
                ? `This card is restricted in ${format}.`
                : `This card is not legal in ${format}.`,
        });
      }
    }

    const singleton = commanderFormat;

    for (const card of main) {
      const basic =
        /\bBasic Land\b/i.test(
          card.typeLine ?? "",
        ) ||
        /^(Plains|Island|Swamp|Mountain|Forest|Wastes)$/i.test(
          card.name,
        );

      if (
        !basic &&
        ((singleton && card.quantity > 1) ||
          (!singleton &&
            format !== "Vintage" &&
            card.quantity > 4) ||
          (format === "Vintage" &&
            card.legalities?.vintage === "restricted" &&
            card.quantity > 1))
      ) {
        issues.push({
          cardId: card.id,
          cardName: card.name,
          severity: "error",
          code: "copy_limit",
          message: singleton
            ? `This card exceeds the singleton limit for ${format}.`
            : format === "Vintage" &&
                card.legalities?.vintage === "restricted"
              ? "Vintage restricted cards are limited to one copy."
            : `This card exceeds the four-copy limit for ${format}.`,
        });
      }
    }

    const commandZoneCheck =
      validateCommandZone(
        commanders,
        format,
      );
    issues.push(...commandZoneCheck);

    const expectedMain =
      commanderFormat ? 98 +
        (commanders.length === 1 ? 1 : 0)
      : null;
    const mainQuantity = main.reduce(
      (sum, card) =>
        sum + card.quantity,
      0,
    );

    if (
      expectedMain &&
      mainQuantity +
        commanders.length !==
        100
    ) {
      issues.push({
        severity: "warning",
        code: "deck_size",
        message: `${format} expects ${
          100
        } total cards. This deck currently has ${
          mainQuantity +
          commanders.length
        }.`,
      });
    }

    const tokenAnalysis =
      await analyzeTokens(enriched);
    const tokens =
      tokenAnalysis.tokens;
    const ownership = buildOwnership(
      enriched,
      inventory,
    );

    return NextResponse.json({
      valid: !issues.some(
        (issue) =>
          issue.severity === "error",
      ),
      issues,
      tokens,
      tokenSupport:
        tokenAnalysis.support,
      ownership,
      cards: enriched.map((card) => {
        const issue = issues.find(
          (entry) =>
            entry.cardId === card.id,
        );
        return {
          id: card.id,
          legalityStatus:
            issue?.code === "banned"
              ? "banned"
              : issue?.code ===
                    "restricted"
                ? "restricted"
                : issue
                  ? "not_legal"
                  : "legal",
          legalityMessage:
            issue?.message ?? "",
        };
      }),
    });
  } catch (error) {
    console.error(
      "Deck intelligence error",
      error,
    );
    return NextResponse.json(
      {
        error:
          "Deck intelligence could not complete the analysis.",
      },
      { status: 500 },
    );
  }
}

async function enrich(
  cards: InputCard[],
) {
  const resolvedByName =
    new Map<string, any>();
  const resolvedByPrinting =
    new Map<string, any>();
  const resolvedByUuid =
    new Map<string, any>();

  for (
    let index = 0;
    index < cards.length;
    index += 75
  ) {
    const chunk = cards.slice(
      index,
      index + 75,
    );

    const identifiers = chunk.map(
      (card) => {
        if (
          card.setCode &&
          card.collectorNumber
        ) {
          return {
            set: card.setCode,
            collector_number:
              card.collectorNumber,
          };
        }

        const scryfallId =
          extractScryfallId(card.id);

        if (scryfallId) {
          return {
            id: scryfallId,
          };
        }

        return {
          name: card.name,
        };
      },
    );

    const response = await fetch(
      "https://api.scryfall.com/cards/collection",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type":
            "application/json",
          "User-Agent":
            "TradingDocks-DeckIntelligence/2.1",
        },
        body: JSON.stringify({
          identifiers,
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      continue;
    }

    const payload =
      await response.json();

    for (const card of payload.data ?? []) {
      resolvedByName.set(
        String(card.name).toLowerCase(),
        card,
      );

      resolvedByUuid.set(
        String(card.id).toLowerCase(),
        card,
      );

      resolvedByPrinting.set(
        `${String(
          card.set,
        ).toLowerCase()}:${String(
          card.collector_number,
        ).toLowerCase()}`,
        card,
      );
    }
  }

  return cards.map((card) => {
    const printingKey =
      card.setCode &&
      card.collectorNumber
        ? `${card.setCode.toLowerCase()}:${card.collectorNumber.toLowerCase()}`
        : "";

    const scryfallId =
      extractScryfallId(card.id);

    const scryfall =
      (printingKey
        ? resolvedByPrinting.get(
            printingKey,
          )
        : undefined) ??
      (scryfallId
        ? resolvedByUuid.get(
            scryfallId,
          )
        : undefined) ??
      resolvedByName.get(
        card.name.toLowerCase(),
      );

    const faces =
      scryfall?.card_faces ?? [];

    const oracleText = [
      scryfall?.oracle_text,
      ...faces.map(
        (face: any) =>
          face.oracle_text,
      ),
    ]
      .filter(Boolean)
      .join(" // ");

    return {
      ...card,
      typeLine:
        scryfall?.type_line ??
        card.typeLine ??
        "",
      oracleText,
      legalities:
        scryfall?.legalities ?? {},
      keywords:
        scryfall?.keywords ?? [],
      allParts:
        scryfall?.all_parts ?? [],
      image:
        scryfall?.image_uris
          ?.normal ??
        faces[0]?.image_uris
          ?.normal ??
        "",
      colorIdentity:
        scryfall?.color_identity ??
        card.colors ??
        [],
      scryfallResolved:
        Boolean(scryfall),
    };
  });
}

function extractScryfallId(
  rawId: string,
) {
  const match = rawId.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  );

  return match?.[0]?.toLowerCase() ?? "";
}

function validateCommandZone(
  commanders: any[],
  format: string,
) {
  const issues: Array<{
    cardId?: string;
    cardName?: string;
    severity: "error" | "warning";
    code: string;
    message: string;
  }> = [];

  const supportsCommanders =
    format === "EDH" ||
    format === "Pauper EDH";

  if (!supportsCommanders) {
    return issues;
  }

  if (!commanders.length) {
    issues.push({
      severity: "error",
      code: "missing_commander",
      message:
        "This format requires a commander.",
    });
    return issues;
  }

  if (commanders.length > 2) {
    issues.push({
      severity: "error",
      code: "too_many_commanders",
      message:
        "The command zone supports at most two commanders.",
    });
  }

  if (commanders.length === 2) {
    const [first, second] = commanders;
    const a = String(
      first.oracleText ?? "",
    ).toLowerCase();
    const b = String(
      second.oracleText ?? "",
    ).toLowerCase();

    const legalPair =
      (a.includes("partner") &&
        b.includes("partner")) ||
      (a.includes(
        "friends forever",
      ) &&
        b.includes(
          "friends forever",
        )) ||
      (a.includes(
        "choose a background",
      ) &&
        String(
          second.typeLine ?? "",
        ).includes(
          "Legendary Enchantment — Background",
        )) ||
      (b.includes(
        "choose a background",
      ) &&
        String(
          first.typeLine ?? "",
        ).includes(
          "Legendary Enchantment — Background",
        )) ||
      (a.includes(
        "doctor's companion",
      ) &&
        String(
          second.typeLine ?? "",
        ).includes("Doctor")) ||
      (b.includes(
        "doctor's companion",
      ) &&
        String(
          first.typeLine ?? "",
        ).includes("Doctor"));

    if (!legalPair) {
      issues.push({
        severity: "error",
        code: "illegal_partner_pair",
        message:
          "These two cards are not a legal Partner, Friends Forever, Background, or Doctor's Companion command-zone pair.",
      });
    }
  }

  return issues;
}

async function analyzeTokens(
  cards: any[],
) {
  const tokenMap = new Map<
    string,
    {
      name: string;
      image?: string;
      createdBy: Set<string>;
      score: number;
    }
  >();

  const support: Array<{
    cardName: string;
    role:
      | "multiplier"
      | "payoff"
      | "copier"
      | "consumer";
    explanation: string;
  }> = [];

  const supportKeys = new Set<string>();

  const addSupport = (
    cardName: string,
    role:
      | "multiplier"
      | "payoff"
      | "copier"
      | "consumer",
    explanation: string,
  ) => {
    const key = `${cardName}:${role}`;
    if (supportKeys.has(key)) return;
    supportKeys.add(key);
    support.push({
      cardName,
      role,
      explanation,
    });
  };

  const addToken = (
    rawName: string,
    source: string,
    score = 1,
  ) => {
    const name =
      normalizeRealTokenName(rawName);
    if (!name) return;

    const key = name.toLowerCase();
    const existing =
      tokenMap.get(key) ?? {
        name,
        image: "",
        createdBy:
          new Set<string>(),
        score: 0,
      };

    existing.createdBy.add(source);
    existing.score += score;
    tokenMap.set(key, existing);
  };

  for (const card of cards) {
    const oracleText = String(
      card.oracleText ?? "",
    ).replace(/\n/g, " ");

    // Scryfall related token objects are the most authoritative source.
    for (const part of card.allParts ?? []) {
      const component = String(
        part.component ?? "",
      ).toLowerCase();
      const partType = String(
        part.type_line ?? "",
      ).toLowerCase();

      if (
        component === "token" ||
        partType.includes("token")
      ) {
        addToken(
          part.name,
          card.name,
          10,
        );
      }
    }

    classifyTokenSupport(
      card.name,
      oracleText,
      addSupport,
    );

    // Only parse clauses that explicitly name a token immediately before
    // the word token. This avoids fragments such as "twice of those."
    const explicitPatterns = [
      /(?:create|creates|created|creating)\s+(?:up to\s+)?(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|x|that many|\d+)?\s*(?:tapped(?: and attacking)?\s+)?(?:legendary\s+)?(?:colorless\s+|white\s+|blue\s+|black\s+|red\s+|green\s+|multicolored\s+)*(?:\d+\/\d+\s+)?([A-Za-z][A-Za-z' -]{0,28}?)\s+(?:artifact\s+|enchantment\s+|creature\s+)*tokens?\b/gi,
      /(?:plus|and)\s+(?:an?|one|two|three|that many|\d+)\s+(?:additional\s+)?(?:\d+\/\d+\s+)?(?:colorless\s+|white\s+|blue\s+|black\s+|red\s+|green\s+)*([A-Za-z][A-Za-z' -]{0,28}?)\s+(?:artifact\s+|creature\s+)*tokens?\b/gi,
      /(?:an?|one|two|three|\d+)\s+additional\s+([A-Za-z][A-Za-z' -]{0,28}?)\s+(?:artifact\s+|creature\s+)*tokens?\b/gi,
      /tokens?\s+named\s+([A-Za-z][A-Za-z' -]{1,35})/gi,
    ];

    for (const pattern of explicitPatterns) {
      for (
        const match of oracleText.matchAll(
          pattern,
        )
      ) {
        const candidate =
          normalizeRealTokenName(
            match[1],
          );

        if (
          candidate &&
          isPlausibleTokenName(
            candidate,
          )
        ) {
          addToken(
            candidate,
            card.name,
            4,
          );
        }
      }
    }

    // Known token nouns are accepted only when the same sentence explicitly
    // says that token is created or is created as an additional token.
    for (const tokenName of KNOWN_TOKEN_NAMES) {
      const escaped =
        escapeRegExp(tokenName);
      const explicitCreation =
        new RegExp(
          `(?:create|creates|created|creating|plus|additional)[^.]{0,90}\\b${escaped}\\b[^.]{0,35}\\btokens?\\b`,
          "i",
        );

      if (
        explicitCreation.test(
          oracleText,
        )
      ) {
        addToken(
          tokenName,
          card.name,
          5,
        );
      }
    }

    if (
      /\bemblem with\b/i.test(
        oracleText,
      )
    ) {
      addToken(
        `${card.name} Emblem`,
        card.name,
        5,
      );
    }
  }

  const tokens = Array.from(
    tokenMap.values(),
  )
    .filter((token) =>
      isPlausibleTokenName(
        token.name,
      ),
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.createdBy.size -
          a.createdBy.size ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 40);

  await Promise.all(
    tokens.map(async (token) => {
      const queries = [
        `t:token name:"${token.name}"`,
        `t:token "${token.name}"`,
      ];

      for (const query of queries) {
        try {
          const params =
            new URLSearchParams({
              q: query,
              unique: "prints",
              order: "released",
              dir: "desc",
            });
          const response = await fetch(
            `https://api.scryfall.com/cards/search?${params.toString()}`,
            {
              headers: {
                Accept:
                  "application/json",
                "User-Agent":
                  "TradingDocks-TokenClassifier/1.0",
              },
              next: {
                revalidate: 86400,
              },
            },
          );

          if (!response.ok) continue;
          const payload =
            await response.json();
          token.image =
            payload.data?.[0]
              ?.image_uris?.normal ??
            payload.data?.[0]
              ?.card_faces?.[0]
              ?.image_uris?.normal ??
            "";

          if (token.image) break;
        } catch {}
      }
    }),
  );

  const displayTokens = tokens.filter(
    (token) =>
      Boolean(token.image) ||
      KNOWN_TOKEN_NAMES.some(
        (known) =>
          known.toLowerCase() ===
          token.name.toLowerCase(),
      ) ||
      /\bEmblem$/i.test(token.name),
  );

  return {
    tokens: displayTokens.map((token) => ({
      name: token.name,
      image: token.image,
      createdBy: Array.from(
        token.createdBy,
      ),
      estimatedQuantity:
        "One token card",
    })),
    support: support.sort(
      (a, b) =>
        roleOrder(a.role) -
          roleOrder(b.role) ||
        a.cardName.localeCompare(
          b.cardName,
        ),
    ),
  };
}

const KNOWN_TOKEN_NAMES = [
  "Angel",
  "Army",
  "Beast",
  "Bird",
  "Blood",
  "Clue",
  "Construct",
  "Dragon",
  "Eldrazi Spawn",
  "Eldrazi Scion",
  "Elephant",
  "Faerie",
  "Food",
  "Goblin",
  "Gold",
  "Golem",
  "Human",
  "Insect",
  "Knight",
  "Map",
  "Plant",
  "Powerstone",
  "Rat",
  "Role",
  "Saproling",
  "Servo",
  "Soldier",
  "Spider",
  "Spirit",
  "Squirrel",
  "Thopter",
  "Treasure",
  "Vampire",
  "Warrior",
  "Wolf",
  "Zombie",
];

function classifyTokenSupport(
  cardName: string,
  oracleText: string,
  addSupport: (
    cardName: string,
    role:
      | "multiplier"
      | "payoff"
      | "copier"
      | "consumer",
    explanation: string,
  ) => void,
) {
  if (
    /(?:twice|double)[^.]{0,80}(?:token|tokens)|additional token for each|that many of those tokens/i.test(
      oracleText,
    )
  ) {
    addSupport(
      cardName,
      "multiplier",
      "Increases the number of tokens created but does not define a new token type.",
    );
  }

  if (
    /whenever[^.]{0,100}(?:token|tokens)[^.]{0,80}(?:dies|die|leave|leaves|enters|enter|created)|for each token you control|tokens you control get|creature tokens you control/i.test(
      oracleText,
    )
  ) {
    addSupport(
      cardName,
      "payoff",
      "Rewards, modifies, or triggers from tokens already being created or controlled.",
    );
  }

  if (
    /\bpopulate\b|create a token that's a copy|token that's a copy|copy target token/i.test(
      oracleText,
    )
  ) {
    addSupport(
      cardName,
      "copier",
      "Copies or populates an existing token and does not require a separate new token type.",
    );
  }

  if (
    /sacrifice (?:a|another|one or more) token|remove .* counter from .* token|tap .* tokens you control/i.test(
      oracleText,
    )
  ) {
    addSupport(
      cardName,
      "consumer",
      "Uses tokens as a resource rather than creating a named token.",
    );
  }
}

function normalizeRealTokenName(
  rawName: string,
) {
  const cleaned = rawName
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+\/\d+\b/g, " ")
    .replace(
      /\b(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|x|that many|twice|additional|tapped|attacking|legendary|colorless|white|blue|black|red|green|multicolored|artifact|enchantment|creature|token|tokens|with|and)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  return cleaned.replace(
    /\b\w/g,
    (letter) =>
      letter.toUpperCase(),
  );
}

function isPlausibleTokenName(
  name: string,
) {
  if (
    name.length < 2 ||
    name.length > 45
  ) {
    return false;
  }

  const rejected =
    /^(?:of those|twice of those|or more|or sacrifice|additional|additional food|that many|those|one or more|card|creature|artifact|enchantment|copy|token|tokens|that'?s copy of target|a copy of target|copy of target|target token|target creature|target artifact)$/i;

  if (rejected.test(name)) {
    return false;
  }

  if (
    /\b(?:that'?s|target|copy of|of target|or more|or sacrifice|twice of those|of those)\b/i.test(
      name,
    )
  ) {
    return false;
  }

  const words = name.split(/\s+/);
  if (words.length > 5) {
    return false;
  }

  return true;
}

function escapeRegExp(
  value: string,
) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

function roleOrder(
  role:
    | "multiplier"
    | "payoff"
    | "copier"
    | "consumer",
) {
  return {
    multiplier: 0,
    copier: 1,
    payoff: 2,
    consumer: 3,
  }[role];
}

function buildOwnership(
  cards: any[],
  inventory: InventoryItem[],
) {
  return cards
    .filter(
      (card) =>
        card.board !== "commander" ||
        card.quantity > 0,
    )
    .map((card) => {
      const normalizedCardName = card.name.trim().toLocaleLowerCase();
      const matches = inventory.filter(
        (item) =>
          item.name.trim().toLocaleLowerCase() === normalizedCardName &&
          Number(item.quantity) > 0,
      );
      const owned = matches.reduce(
        (sum, item) =>
          sum + item.quantity,
        0,
      );

      return {
        cardId: card.id,
        cardName: card.name,
        required: card.quantity,
        owned,
        matches,
      };
    });
}
