import type {
  AppraisalCard,
  BuyingSettings,
  Condition,
  ParsedCardLine,
  PriceFinish,
  ScryfallCard,
} from "./types";

const API_ROOT = "https://api.scryfall.com";
const REQUEST_DELAY_MS = 120;

export const CONDITION_MULTIPLIERS: Record<Condition, number> = {
  NM: 1,
  LP: 0.88,
  MP: 0.72,
  HP: 0.52,
  DMG: 0.32,
};

export function parseCollectionText(text: string): ParsedCardLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCardLine);
}

export function parseCardLine(raw: string): ParsedCardLine {
  let working = raw.trim();
  let quantity = 1;
  let condition: Condition = "NM";
  let finish: PriceFinish = "nonfoil";
  let setCode: string | undefined;
  let collectorNumber: string | undefined;

  const quantityMatch = working.match(/^\s*(\d+)\s*(?:x|×)?\s+(.+)$/i);
  if (quantityMatch) {
    quantity = Math.max(1, Number(quantityMatch[1]));
    working = quantityMatch[2].trim();
  }

  const conditionMatch = working.match(/\s+(NM|LP|MP|HP|DMG)\s*$/i);
  if (conditionMatch) {
    condition = conditionMatch[1].toUpperCase() as Condition;
    working = working.slice(0, conditionMatch.index).trim();
  }

  const finishMatch = working.match(/\s+(FOIL|ETCHED|NONFOIL)\s*$/i);
  if (finishMatch) {
    const value = finishMatch[1].toLowerCase();
    finish = value === "foil" ? "foil" : value === "etched" ? "etched" : "nonfoil";
    working = working.slice(0, finishMatch.index).trim();
  }

  const setMatch = working.match(/\s*\[([A-Za-z0-9]+)(?:\s*#\s*([^\]]+))?\]\s*$/);
  if (setMatch) {
    setCode = setMatch[1].toLowerCase();
    collectorNumber = setMatch[2]?.trim();
    working = working.slice(0, setMatch.index).trim();
  }

  return {
    raw,
    quantity,
    name: working,
    setCode,
    collectorNumber,
    finish,
    condition,
  };
}

export async function resolveCard(
  input: ParsedCardLine,
): Promise<ScryfallCard> {
  let endpoint: string;

  if (input.setCode && input.collectorNumber) {
    endpoint = `/cards/${encodeURIComponent(input.setCode)}/${encodeURIComponent(
      input.collectorNumber,
    )}`;
  } else {
    const params = new URLSearchParams();
    params.set("exact", input.name);
    if (input.setCode) params.set("set", input.setCode);
    endpoint = `/cards/named?${params.toString()}`;
  }

  const response = await fetch(`${API_ROOT}${endpoint}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const fuzzyParams = new URLSearchParams({ fuzzy: input.name });
    if (input.setCode) fuzzyParams.set("set", input.setCode);

    const fuzzyResponse = await fetch(
      `${API_ROOT}/cards/named?${fuzzyParams.toString()}`,
      { headers: { Accept: "application/json" } },
    );

    if (!fuzzyResponse.ok) {
      const error = await fuzzyResponse.json().catch(() => null);
      throw new Error(error?.details ?? `Could not find ${input.name}.`);
    }

    return fuzzyResponse.json();
  }

  return response.json();
}

export async function resolveCollection(
  rows: ParsedCardLine[],
  onProgress: (index: number, card?: ScryfallCard, error?: string) => void,
) {
  const batchSize = 75;

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const identifiers = batch.map((row) =>
      row.setCode && row.collectorNumber
        ? { set: row.setCode, collector_number: row.collectorNumber }
        : row.setCode
          ? { name: row.name, set: row.setCode }
          : { name: row.name },
    );

    try {
      const response = await fetch(`${API_ROOT}/cards/collection`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifiers }),
      });

      if (!response.ok) {
        throw new Error("Scryfall collection lookup failed.");
      }

      const payload: {
        data: ScryfallCard[];
        not_found?: Array<Record<string, string>>;
      } = await response.json();

      const available = [...payload.data];

      batch.forEach((row, batchIndex) => {
        const absoluteIndex = offset + batchIndex;
        const matchIndex = available.findIndex((card) => {
          if (row.setCode && row.collectorNumber) {
            return (
              card.set.toLowerCase() === row.setCode.toLowerCase() &&
              card.collector_number.toLowerCase() ===
                row.collectorNumber.toLowerCase()
            );
          }

          const sameName = card.name.toLowerCase() === row.name.toLowerCase();
          return row.setCode
            ? sameName && card.set.toLowerCase() === row.setCode.toLowerCase()
            : sameName;
        });

        if (matchIndex >= 0) {
          const [card] = available.splice(matchIndex, 1);
          onProgress(absoluteIndex, card);
        } else {
          onProgress(
            absoluteIndex,
            undefined,
            `Could not find ${row.name}. Select a different printing or edit the entry.`,
          );
        }
      });
    } catch {
      for (let batchIndex = 0; batchIndex < batch.length; batchIndex += 1) {
        const absoluteIndex = offset + batchIndex;

        try {
          const card = await resolveCard(batch[batchIndex]);
          onProgress(absoluteIndex, card);
        } catch (error) {
          onProgress(
            absoluteIndex,
            undefined,
            error instanceof Error ? error.message : "Unknown Scryfall error.",
          );
        }

        if (batchIndex < batch.length - 1) {
          await wait(REQUEST_DELAY_MS);
        }
      }
    }

    if (offset + batchSize < rows.length) {
      await wait(REQUEST_DELAY_MS);
    }
  }
}

export async function searchPrintings(
  cardName: string,
): Promise<ScryfallCard[]> {
  const cards: ScryfallCard[] = [];
  let nextPage: string | null =
    `${API_ROOT}/cards/search?${new URLSearchParams({
      q: `!"${cardName.replaceAll('"', '\\"')}"`,
      unique: "prints",
      order: "released",
      dir: "desc",
      include_extras: "false",
    }).toString()}`;

  while (nextPage) {
    const response = await fetch(nextPage, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(
        error?.details ?? `Could not retrieve printings for ${cardName}.`,
      );
    }

    const payload: {
      data: ScryfallCard[];
      has_more: boolean;
      next_page?: string;
    } = await response.json();

    cards.push(...payload.data);
    nextPage =
      payload.has_more && payload.next_page ? payload.next_page : null;

    if (nextPage) await wait(REQUEST_DELAY_MS);
  }

  return cards.filter(
    (card) =>
      card.prices.usd || card.prices.usd_foil || card.prices.usd_etched,
  );
}

export function getCardPrice(card: ScryfallCard, finish: PriceFinish) {
  const raw =
    finish === "foil"
      ? card.prices.usd_foil
      : finish === "etched"
        ? card.prices.usd_etched
        : card.prices.usd;

  return raw ? Number(raw) : 0;
}

export function calculateSuggestedPercent(
  card: ScryfallCard,
  adjustedUnitValue: number,
  ownedQuantity: number,
) {
  let percent = 58;

  if (adjustedUnitValue >= 100) percent += 10;
  else if (adjustedUnitValue >= 40) percent += 8;
  else if (adjustedUnitValue >= 15) percent += 6;
  else if (adjustedUnitValue >= 5) percent += 2;
  else if (adjustedUnitValue < 1) percent -= 18;

  if (card.reserved) percent += 7;
  if (!card.reprint) percent += 2;
  if (card.rarity === "mythic") percent += 2;

  if (card.edhrec_rank) {
    if (card.edhrec_rank <= 500) percent += 8;
    else if (card.edhrec_rank <= 2500) percent += 5;
    else if (card.edhrec_rank <= 10000) percent += 1;
    else percent -= 3;
  }

  if (ownedQuantity >= 20) percent -= 8;
  else if (ownedQuantity >= 10) percent -= 5;
  else if (ownedQuantity >= 5) percent -= 2;

  return clamp(percent, 25, 82);
}

export function applyOfferMode(
  suggestedPercent: number,
  settings: BuyingSettings,
) {
  if (settings.offerMode === "custom") {
    return clamp(settings.customOfferPercent, 0, 100);
  }

  const adjustment =
    settings.offerMode === "safe"
      ? -7
      : settings.offerMode === "aggressive"
        ? 5
        : 0;

  return clamp(
    suggestedPercent + adjustment + settings.cashAdjustmentPercent,
    0,
    90,
  );
}

export function hydrateAppraisalCard(
  parsed: ParsedCardLine,
  card: ScryfallCard,
  settings: BuyingSettings,
  existing?: Partial<AppraisalCard>,
): AppraisalCard {
  const unitMarket = getCardPrice(card, parsed.finish);
  const conditionMultiplier = CONDITION_MULTIPLIERS[parsed.condition];
  const adjustedUnitValue = unitMarket * conditionMultiplier;
  const ownedQuantity = existing?.ownedQuantity ?? 0;
  const suggestedPercent = calculateSuggestedPercent(
    card,
    adjustedUnitValue,
    ownedQuantity,
  );

  return {
    ...parsed,
    rowId: existing?.rowId ?? crypto.randomUUID(),
    status: "ready",
    card,
    unitMarket,
    conditionMultiplier,
    adjustedUnitValue,
    lineMarketValue: adjustedUnitValue * parsed.quantity,
    suggestedPercent,
    ownedQuantity,
  };
}

export function estimateCardEconomics(
  item: AppraisalCard,
  settings: BuyingSettings,
) {
  const offerPercent = applyOfferMode(item.suggestedPercent, settings);
  const offer = item.lineMarketValue * (offerPercent / 100);
  const fee = item.lineMarketValue * (settings.feePercent / 100);
  const shipping =
    (item.quantity / Math.max(1, settings.averageCardsPerOrder)) *
    settings.shippingPerOrder;
  const labor = item.quantity * settings.laborPerCard;
  const projectedNet = Math.max(0, item.lineMarketValue - fee - shipping - labor);
  const projectedProfit = projectedNet - offer;
  const projectedMargin =
    projectedNet > 0 ? (projectedProfit / projectedNet) * 100 : 0;

  return {
    offerPercent,
    offer,
    fee,
    shipping,
    labor,
    projectedNet,
    projectedProfit,
    projectedMargin,
  };
}

export function cardImage(card?: ScryfallCard) {
  return (
    card?.image_uris?.small ??
    card?.card_faces?.[0]?.image_uris?.small ??
    ""
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
