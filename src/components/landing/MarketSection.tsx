"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

type GameId = "magic" | "pokemon" | "pokemon-japan" | "lorcana" | "one-piece";
type MarketMode = "trending" | "movers" | "volume" | "opportunities";

type MarketCard = {
  id: string;
  name: string;
  setName: string;
  setCode: string;
  collectorNumber: string;
  marketPrice: number;
  change24h: number;
  change7d: number;
  demand: "High" | "Medium" | "Low";
  volumeScore: number;
  opportunityScore: number;
  source: string;
  image?: string;
  game: GameId;
  suggestedAction: "REPRICE" | "HOLD" | "LIST" | "REVIEW";
  imageUrl?: string;
  imageSource: "scryfall" | "placeholder";
  hasVerifiedArtwork: boolean;
};

// Deliberately illustrative: never presented as provider quotes or live prices.
const SAMPLE_NAMES: Record<GameId, string[]> = {
  magic: ["Mox Amber", "Lightning Greaves", "The One Ring", "Rhystic Study", "Cavern of Souls"],
  pokemon: ["Pikachu ex", "Charizard ex", "Mew ex"],
  "pokemon-japan": ["Pikachu ex", "Charizard ex", "Mew ex"],
  lorcana: ["Elsa — Spirit of Winter", "Stitch — Rock Star", "Mickey Mouse — Brave Little Tailor"],
  "one-piece": ["Monkey.D.Luffy", "Roronoa Zoro", "Nami"],
};

const SAMPLE_ART: Record<string, string> = {
  "Mox Amber": "https://cards.scryfall.io/small/front/6/6/66024e69-ad60-4c9a-a0ca-da138d33ad80.jpg",
  "Lightning Greaves": "https://cards.scryfall.io/normal/front/b/6/b61634ae-05be-4b56-8ebb-9d4ade902e42.jpg",
  "Rhystic Study": "https://cards.scryfall.io/normal/front/9/f/9f37c5b6-a59c-45cd-9a99-e9357fe9ea1b.jpg",
  "Cavern of Souls": "https://cards.scryfall.io/normal/front/3/a/3aad15a2-8a1b-4460-9b06-e85863081878.jpg",
  "The One Ring": "https://cards.scryfall.io/normal/front/d/5/d5806e68-1054-458e-866d-1f2470f682b2.jpg",
};

function sampleCards(game: GameId): MarketCard[] {
  const cards: MarketCard[] = SAMPLE_NAMES[game].map((name, index) => ({
    id: `${game}-sample-${index}`, name, setName: game === "magic" ? ["The Brothers' War", "Marvel Super Heroes Commander", "The Lord of the Rings: Tales of Middle-earth", "Jumpstart 2022", "The Lost Caverns of Ixalan"][index] : "Demo catalog set", setCode: game === "magic" ? ["BRO", "M3C", "LTR", "J22", "LCI"][index] : "DEMO",
    collectorNumber: game === "magic" ? ["179", "202", "246", "114", "357"][index] : String(index + 1).padStart(3, "0"),
    marketPrice: [24, 12, 82, 31, 47][index] ?? 0, change24h: [2, -1, 0.5, -0.82, 1.34][index] ?? 0,
    change7d: [8, -4, 2, -3.2, 6.4][index] ?? 0, demand: index === 0 ? "High" : index === 4 ? "High" : "Medium",
    volumeScore: [80, 60, 95, 72, 86][index] ?? 50, opportunityScore: [65, 85, 40, 78, 70][index] ?? 50,
    source: "Illustrative sample",
    image: SAMPLE_ART[name],
    imageUrl: SAMPLE_ART[name],
    imageSource: SAMPLE_ART[name] ? "scryfall" : "placeholder",
    hasVerifiedArtwork: game === "magic" && Boolean(SAMPLE_ART[name]),
    game,
    suggestedAction: index === 1 || index === 3 ? "REPRICE" : index === 2 ? "HOLD" : index === 4 ? "LIST" : "REVIEW",
  } as MarketCard));
  if (process.env.NODE_ENV !== "production") {
    cards.forEach((card) => {
      if (!card.imageUrl && card.imageUrl === "") console.warn(`[Market Intelligence] Empty imageUrl for ${card.name}.`);
      if (card.game === "magic" && !card.imageUrl) console.warn(`[Market Intelligence] Magic card ${card.name} is missing verified Scryfall artwork.`);
      if (card.imageUrl && !card.imageUrl.startsWith("https://cards.scryfall.io/")) console.warn(`[Market Intelligence] Unsupported artwork host for ${card.name}.`);
    });
  }
  return cards;
}
const GAME_TABS: Array<{ id: GameId; label: string; shortLabel: string }> = [
  { id: "magic", label: "Magic: The Gathering", shortLabel: "Magic" },
  { id: "pokemon", label: "Pokemon", shortLabel: "Pokemon" },
  { id: "pokemon-japan", label: "Pokemon Japan", shortLabel: "Pokemon JP" },
  { id: "lorcana", label: "Disney Lorcana", shortLabel: "Lorcana" },
  { id: "one-piece", label: "One Piece", shortLabel: "One Piece" },
];

const MODES: Array<{ id: MarketMode; label: string; description: string }> = [
  { id: "trending", label: "Balanced signal", description: "Movement plus demand" },
  { id: "movers", label: "Price movement", description: "Largest seven-day changes" },
  { id: "volume", label: "Demand", description: "Highest volume signals" },
  { id: "opportunities", label: "Spread", description: "Potential acquisition margin" },
];

export function MarketSection() {
  const [activeGame, setActiveGame] = useState<GameId>("magic");
  const [activeMode, setActiveMode] = useState<MarketMode>("trending");

  const selectedGame = GAME_TABS.find((game) => game.id === activeGame) ?? GAME_TABS[0];
  const selectedMode = MODES.find((mode) => mode.id === activeMode) ?? MODES[0];
  const cards = useMemo(
    () => rankCards(sampleCards(activeGame), activeMode),
    [activeGame, activeMode],
  );
  const primaryCard = cards.find((card) => card.hasVerifiedArtwork) ?? cards[0] ?? null;

  return (
    <section
      id="market"
      className="relative z-10 border-y border-td-ink/[0.06] bg-td-surface px-5 py-14 text-td-primary sm:px-8 sm:py-16 lg:px-12"
    >
      <div className="mx-auto max-w-[1240px]">
        <div className="grid min-w-0 gap-8">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-td-accent-text">03 / Market intelligence</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-5xl">
              See market signals in context.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-td-secondary">
              Explore a sample market snapshot. All products, prices, changes,
              and demand scores below are illustrative examples, not current
              market quotes or buying recommendations.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/dashboard/market-intelligence"
                className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-td-accent px-4 text-sm font-semibold text-td-on-accent transition hover:bg-td-accent-hover"
              >
                Open Market Center
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="min-w-0">
            <div className="grid min-w-0 border-y border-td-ink/[0.08] lg:grid-cols-[1fr_260px]">
              <div className="border-b border-td-ink/[0.08] py-5 lg:border-b-0 lg:border-r lg:pr-6">
                <div className="flex flex-wrap gap-2">
                  {GAME_TABS.map((game) => (
                    <button
                      key={game.id}
                      type="button"
                      onClick={() => setActiveGame(game.id)}
                      aria-pressed={activeGame === game.id}
                      className={[
                        "h-9 border px-3 text-sm transition",
                        activeGame === game.id
                          ? "border-td-accent/40 text-td-primary"
                          : "border-td-ink/[0.09] text-td-secondary hover:text-td-primary",
                      ].join(" ")}
                    >
                      {game.shortLabel}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setActiveMode(mode.id)}
                      aria-pressed={activeMode === mode.id}
                      className={[
                        "h-9 border px-3 text-sm transition",
                        activeMode === mode.id
                          ? "border-td-accent/40 text-td-accent-text"
                          : "border-td-ink/[0.09] text-td-secondary hover:text-td-primary",
                      ].join(" ")}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="py-5 lg:pl-6">
                <p className="text-sm font-semibold text-td-primary">{selectedGame.label}</p>
                <p className="mt-1 text-xs text-td-secondary">{selectedMode.description}</p>
                <div className="mt-4 grid gap-2 text-xs">
                  <StatusRow label="Source" value="Illustrative sample" />
                  <StatusRow label="Prices" value="Demo values in USD" />
                  <StatusRow label="Availability" value="Interactive preview" />
                </div>
              </div>
            </div>

            <div className="grid min-w-0 gap-8 py-8 lg:grid-cols-[280px_1fr]">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-td-primary">Sample lead signal</p>
                {primaryCard ? (
                  <div className="mt-5 border-y border-td-ink/[0.08] py-5">
                    <MarketCardArtwork card={primaryCard} variant="featured" />
                    <p className="text-2xl font-semibold tracking-[-0.035em] text-td-primary">
                      {primaryCard.name}
                    </p>
                    <p className="mt-2 text-sm text-td-secondary">
                      {primaryCard.setName} #{primaryCard.collectorNumber}
                    </p>
                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <Metric label="Market · demo" value={currency(primaryCard.marketPrice)} />
                      <Metric label="24H move" value={signedPercent(primaryCard.change24h)} />
                      <Metric label="7D move" value={signedPercent(primaryCard.change7d)} />
                      <Metric label="Demand" value={primaryCard.demand} />
                      <Metric label="Opportunity" value={`${primaryCard.opportunityScore}/100`} />
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-td-ink/[0.08] pt-4"><span className="text-xs text-td-secondary">Suggested action</span><span className="rounded-full border border-td-accent/30 bg-td-accent/[0.08] px-3 py-1.5 text-xs font-semibold text-td-accent-text">{primaryCard.suggestedAction}</span></div>
                  </div>
                ) : (
                  <p className="mt-5 border-y border-td-ink/[0.08] py-5 text-sm leading-6 text-td-secondary">
                    No sample available for this selection.
                  </p>
                )}
              </div>

              <div className="min-w-0 overflow-x-auto" role="region" aria-label="Sample market comparison" tabIndex={0}>
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <caption className="sr-only">Illustrative market data. All values are examples.</caption>
                  <thead>
                    <tr className="border-b border-td-ink/[0.08] text-xs text-td-secondary">
                      <th className="py-3 pr-6 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Market</th>
                      <th className="px-4 py-3 font-medium">24h</th>
                      <th className="px-4 py-3 font-medium">7d</th>
                      <th className="px-4 py-3 font-medium">Demand</th>
                      <th className="px-4 py-3 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.slice(0, 8).map((card) => (
                      <tr key={card.id} className="border-b border-td-ink/[0.055] last:border-b-0">
                        <td className="py-4 pr-6">
                          <div className="flex items-center gap-3"><MarketCardArtwork card={card} variant="thumbnail" /><div><p className="text-sm font-semibold text-td-primary">{card.name}</p>
                          <p className="mt-1 text-xs text-td-secondary">
                            {card.setCode} #{card.collectorNumber}
                          </p></div></div>
                        </td>
                        <td className="px-4 py-4 text-sm text-td-secondary">{currency(card.marketPrice)}</td>
                        <td className={movementClass(card.change24h)}>{signedPercent(card.change24h)}</td>
                        <td className={movementClass(card.change7d)}>{signedPercent(card.change7d)}</td>
                        <td className="px-4 py-4 text-sm text-td-secondary">{card.demand}</td>
                        <td className="px-4 py-4 text-sm text-td-secondary">{card.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function rankCards(cards: MarketCard[], mode: MarketMode) {
  return [...cards].sort((a, b) => {
    if (mode === "movers") return Math.abs(b.change7d) - Math.abs(a.change7d);
    if (mode === "volume") return b.volumeScore - a.volumeScore;
    if (mode === "opportunities") return b.opportunityScore - a.opportunityScore;
    return b.volumeScore + b.opportunityScore + Math.abs(b.change7d) - (a.volumeScore + a.opportunityScore + Math.abs(a.change7d));
  });
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-td-secondary">{label}</span>
      <span className="text-td-secondary">{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-td-secondary">{label}</p>
      <p className="mt-1 text-sm font-semibold text-td-primary">{value}</p>
    </div>
  );
}

function MarketCardArtwork({ card, variant }: { card: MarketCard; variant: "featured" | "thumbnail" }) {
  const [failed, setFailed] = useState(false);
  const featured = variant === "featured";
  return <div className={`${featured ? "relative mb-5 aspect-[5/7] w-40" : "relative h-12 w-9 shrink-0"} overflow-hidden rounded-md border border-td-ink/[0.12] bg-td-ink/[0.06]`}>
    {card.imageUrl && !failed ? <Image src={card.imageUrl} alt={`${card.name} card artwork`} fill sizes={featured ? "160px" : "36px"} className="object-cover" onError={() => setFailed(true)} /> : <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,rgb(var(--td-brand-blue-rgb)/.34),rgb(var(--td-surface-rgb)/.96)_60%)] p-3 text-td-primary" aria-label={`${card.name} demo preview`}><span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-td-accent-text">{GAME_TABS.find((game) => game.id === card.game)?.shortLabel ?? "TCG"}</span><span className={`${featured ? "text-lg" : "text-[8px]"} font-semibold leading-tight`}>{card.name}</span><span className="text-[8px] uppercase tracking-[0.12em] text-td-muted">Trading Docks sample card</span><i className="pointer-events-none absolute -bottom-10 -right-8 h-28 w-28 rounded-full bg-td-accent/20 blur-2xl" /></div>}
  </div>;
}

function movementClass(value: number) {
  return [
    "px-4 py-4 text-sm font-semibold",
    value > 0 ? "text-td-success" : value < 0 ? "text-td-danger" : "text-td-secondary",
  ].join(" ");
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function signedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
