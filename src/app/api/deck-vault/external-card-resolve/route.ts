import { NextRequest, NextResponse } from "next/server";

type ExternalDropPayload = {
  uriList?: string;
  plainText?: string;
  html?: string;
  mozUrl?: string;
};

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as ExternalDropPayload;
  const candidates = extractCandidates(payload);

  for (const candidate of candidates.urls) {
    const card = await resolveUrl(candidate);
    if (card) return NextResponse.json({ card: normalizeCard(card) });
  }

  for (const name of candidates.names) {
    const card = await fetchScryfall(
      `/cards/named?fuzzy=${encodeURIComponent(name)}`,
    );
    if (card) return NextResponse.json({ card: normalizeCard(card) });
  }

  return NextResponse.json(
    {
      error:
        "Trading Docks could not identify that external card. Drag the card image or its card-page link from Scryfall or EDHREC, rather than highlighted page text.",
    },
    { status: 422 },
  );
}

function extractCandidates(payload: ExternalDropPayload) {
  const combined = [
    payload.uriList,
    payload.plainText,
    payload.mozUrl,
    payload.html,
  ]
    .filter(Boolean)
    .join("\n");

  const urls = Array.from(
    new Set(
      (combined.match(/https?:\/\/[^\s"'<>]+/gi) ?? []).map(cleanUrl),
    ),
  );

  const htmlNames = Array.from(
    combined.matchAll(/(?:alt|title)=["']([^"']{2,120})["']/gi),
  ).map((match) => cleanCardName(match[1]));

  const plainLines = (payload.plainText ?? "")
    .split(/\r?\n/)
    .map(cleanCardName)
    .filter((line) => line.length >= 2 && line.length <= 120)
    .filter((line) => !/^https?:\/\//i.test(line));

  return {
    urls,
    names: Array.from(new Set([...htmlNames, ...plainLines])).filter(Boolean),
  };
}

async function resolveUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "scryfall.com" || host.endsWith(".scryfall.com")) {
    const cardIndex = parts.indexOf("card");
    if (cardIndex >= 0 && parts[cardIndex + 1] && parts[cardIndex + 2]) {
      return fetchScryfall(
        `/cards/${encodeURIComponent(parts[cardIndex + 1])}/${encodeURIComponent(parts[cardIndex + 2])}`,
      );
    }
  }

  if (host === "api.scryfall.com") {
    const cardsIndex = parts.indexOf("cards");
    if (cardsIndex >= 0) {
      const rest = parts.slice(cardsIndex + 1);
      if (rest.length === 1 && isUuid(rest[0])) {
        return fetchScryfall(`/cards/${rest[0]}`);
      }
      if (rest.length >= 2) {
        return fetchScryfall(
          `/cards/${encodeURIComponent(rest[0])}/${encodeURIComponent(rest[1])}`,
        );
      }
    }
  }

  if (host === "cards.scryfall.io") {
    const filename = parts.at(-1)?.replace(/\.(?:jpg|jpeg|png|webp)$/i, "") ?? "";
    if (isUuid(filename)) return fetchScryfall(`/cards/${filename}`);
  }

  // EDHREC card links frequently include a readable card slug.
  if (host === "edhrec.com" || host.endsWith(".edhrec.com")) {
    const cardIndex = parts.findIndex((part) => part === "cards" || part === "card");
    const slug = cardIndex >= 0 ? parts[cardIndex + 1] : parts.at(-1);
    if (slug) {
      const name = slug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
      return fetchScryfall(`/cards/named?fuzzy=${encodeURIComponent(name)}`);
    }
  }

  // A Scryfall image UUID can also be embedded in query strings or HTML redirects.
  const uuid = rawUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0];
  if (uuid) return fetchScryfall(`/cards/${uuid}`);

  return null;
}

async function fetchScryfall(path: string) {
  const response = await fetch(`https://api.scryfall.com${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TradingDocks-DeckVault/2.1",
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json();
}

function normalizeCard(card: any) {
  const face = card.card_faces?.find((entry: any) => entry.image_uris) ?? card;
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

function cleanUrl(value: string) {
  return value.replace(/[),.;]+$/, "").replace(/&amp;/g, "&");
}

function cleanCardName(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*[—|·].*$/, "")
    .replace(/\b(?:Scryfall|EDHREC)\b/gi, "")
    .trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
