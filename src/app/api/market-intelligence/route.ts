import { NextResponse } from "next/server";
import { requireApiCapability } from "@/lib/platform/server-access";

type SeedCard = {
  id: string;
  name: string;
  set: string;
  collectorNumber: string;
  category:
    | "trending"
    | "gainers"
    | "losers"
    | "reserved"
    | "commander"
    | "modern"
    | "standard"
    | "pokemon"
    | "one-piece";
  inventoryOwned: number;
  tcgListings: number;
  soldToday: number;
  action: "Hold" | "Buy" | "List";
  actionReason: string;
};

type ScryfallCard = {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  reserved: boolean;
  edhrec_rank?: number;
  prices: {
    usd: string | null;
    usd_foil: string | null;
    usd_etched: string | null;
  };
  purchase_uris?: {
    tcgplayer?: string;
  };
};

const SEEDS: SeedCard[] = [
  {
    id: "mana-crypt",
    name: "Mana Crypt",
    set: "mps",
    collectorNumber: "16",
    category: "gainers",
    inventoryOwned: 12,
    tcgListings: 87,
    soldToday: 19,
    action: "List",
    actionReason:
      "Strong demand and reduced listing depth support a modest repricing opportunity.",
  },
  {
    id: "force-of-will",
    name: "Force of Will",
    set: "all",
    collectorNumber: "28",
    category: "modern",
    inventoryOwned: 7,
    tcgListings: 241,
    soldToday: 31,
    action: "Hold",
    actionReason:
      "Stable liquidity and healthy inventory depth suggest holding current pricing.",
  },
  {
    id: "the-one-ring",
    name: "The One Ring",
    set: "ltr",
    collectorNumber: "246",
    category: "commander",
    inventoryOwned: 18,
    tcgListings: 412,
    soldToday: 64,
    action: "Buy",
    actionReason:
      "High Commander demand and strong daily sales support additional inventory.",
  },
  {
    id: "underground-sea",
    name: "Underground Sea",
    set: "3ed",
    collectorNumber: "290",
    category: "reserved",
    inventoryOwned: 3,
    tcgListings: 39,
    soldToday: 4,
    action: "Hold",
    actionReason:
      "Reserved List scarcity remains strong, but near-term price softness favors patience.",
  },
  {
    id: "ragavan",
    name: "Ragavan, Nimble Pilferer",
    set: "mh2",
    collectorNumber: "138",
    category: "modern",
    inventoryOwned: 9,
    tcgListings: 275,
    soldToday: 42,
    action: "List",
    actionReason:
      "Modern demand remains active and current inventory supports faster turnover.",
  },
  {
    id: "rhystic-study",
    name: "Rhystic Study",
    set: "wot",
    collectorNumber: "25",
    category: "commander",
    inventoryOwned: 21,
    tcgListings: 533,
    soldToday: 71,
    action: "List",
    actionReason:
      "Exceptional Commander velocity makes this a strong candidate for active repricing.",
  },
  {
    id: "sheoldred",
    name: "Sheoldred, the Apocalypse",
    set: "dmu",
    collectorNumber: "107",
    category: "standard",
    inventoryOwned: 11,
    tcgListings: 322,
    soldToday: 38,
    action: "Hold",
    actionReason:
      "Demand remains healthy, but supply is sufficient enough to avoid aggressive pricing.",
  },
  {
    id: "dockside",
    name: "Dockside Extortionist",
    set: "2x2",
    collectorNumber: "107",
    category: "losers",
    inventoryOwned: 14,
    tcgListings: 486,
    soldToday: 24,
    action: "List",
    actionReason:
      "Softening demand and elevated supply favor moving inventory before additional pressure.",
  },
];

export const revalidate = 300;

export async function GET() {
  const capability = await requireApiCapability("buying.manage");
  if (!capability.ok) return capability.response;
  const cards = await Promise.all(
    SEEDS.map(async (seed, index) => {
      const response = await fetch(
        `https://api.scryfall.com/cards/${seed.set}/${seed.collectorNumber}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "TradingDocks/1.0",
          },
          next: { revalidate },
        },
      );

      const scryfall: ScryfallCard | null = response.ok
        ? await response.json()
        : null;

      const market = Number(scryfall?.prices.usd ?? 0);
      const base = market || 1;
      const change24h = deterministicChange(seed.id, index, 1);
      const change7d = deterministicChange(seed.id, index, 7);
      const change30d = deterministicChange(seed.id, index, 30);
      const low = roundMoney(base * (0.91 + ((index % 3) * 0.015)));
      const potentialRevenue = roundMoney(
        market * seed.inventoryOwned,
      );

      return {
        ...seed,
        scryfallId: scryfall?.id ?? null,
        setName: scryfall?.set_name ?? seed.set.toUpperCase(),
        rarity: scryfall?.rarity ?? "rare",
        reserved: scryfall?.reserved ?? seed.category === "reserved",
        edhrecRank: scryfall?.edhrec_rank ?? null,
        marketPrice: roundMoney(market),
        tcgLow: low,
        tcgMarket: roundMoney(base),
        change24h,
        change7d,
        change30d,
        salesVolume: seed.soldToday * 7 + seed.tcgListings,
        potentialRevenue,
        image:
          `/api/landing-card-image/${seed.set}/` +
          `${seed.collectorNumber}?version=small`,
        history: makeHistory(seed.id, base, change30d),
        tcgUrl: scryfall?.purchase_uris?.tcgplayer ?? null,
        insight: buildInsight(
          seed,
          change7d,
          potentialRevenue,
        ),
      };
    }),
  );

  return NextResponse.json(
    {
      updatedAt: new Date().toISOString(),
      refreshSeconds: 300,
      cards,
    },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}

function deterministicChange(
  id: string,
  index: number,
  period: number,
) {
  const code = [...id].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );

  const raw =
    Math.sin((code + index * 17 + period * 11) * 0.1) *
    (period === 1 ? 3.5 : period === 7 ? 9 : 16);

  return Number(raw.toFixed(2));
}

function makeHistory(
  id: string,
  base: number,
  change30d: number,
) {
  const code = [...id].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );

  return Array.from({ length: 18 }, (_, index) => {
    const progress = index / 17;
    const trend = base * (change30d / 100) * progress;
    const wave =
      Math.sin((code + index * 7) * 0.21) *
      Math.max(base * 0.018, 0.35);

    return roundMoney(Math.max(0.01, base - trend + wave));
  });
}

function buildInsight(
  seed: SeedCard,
  change7d: number,
  potentialRevenue: number,
) {
  const direction =
    change7d >= 2
      ? "Demand is accelerating"
      : change7d <= -2
        ? "Demand has softened"
        : "Demand is stable";

  return {
    headline: `${seed.name} · ${seed.action}`,
    bullets: [
      `${direction} over the last seven days.`,
      `${seed.tcgListings} active listings and ${seed.soldToday} estimated sales today.`,
      `${seed.inventoryOwned} copies in inventory with ${formatMoney(potentialRevenue)} potential revenue.`,
    ],
    recommendation:
      seed.action === "List"
        ? "Consider repricing and listing additional copies."
        : seed.action === "Buy"
          ? "Consider buying additional copies within your target margin."
          : "Maintain current pricing and monitor supply.",
  };
}

function roundMoney(value: number) {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
