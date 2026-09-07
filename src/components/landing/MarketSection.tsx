"use client";

import Link from "next/link";
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
};

// Deliberately illustrative: never presented as provider quotes or live prices.
const SAMPLE_NAMES: Record<GameId, string[]> = {
  magic: ["Sample mythic", "Sample rare", "Sample uncommon"],
  pokemon: ["Sample illustration rare", "Sample ultra rare", "Sample holo"],
  "pokemon-japan": ["Sample Japanese illustration rare", "Sample Japanese ultra rare", "Sample Japanese holo"],
  lorcana: ["Sample enchanted", "Sample legendary", "Sample super rare"],
  "one-piece": ["Sample alternate art", "Sample secret rare", "Sample super rare"],
};

function sampleCards(game: GameId): MarketCard[] {
  return SAMPLE_NAMES[game].map((name, index) => ({
    id: `${game}-sample-${index}`, name, setName: "Example set", setCode: "DEMO",
    collectorNumber: String(index + 1).padStart(3, "0"),
    marketPrice: [24, 12, 3][index], change24h: [2, -1, 0.5][index],
    change7d: [8, -4, 2][index], demand: index === 0 ? "High" : "Medium",
    volumeScore: [80, 60, 95][index], opportunityScore: [65, 85, 40][index],
    source: "Illustrative sample",
  }));
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
  const primaryCard = cards[0] ?? null;

  return (
    <section
      id="market"
      data-td-reveal
      className="relative z-10 border-y border-white/[0.06] bg-[#03080d] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-12"
    >
      <div className="mx-auto max-w-[1480px]">
        <div className="grid min-w-0 gap-10 lg:grid-cols-[360px_1fr]">
          <div className="min-w-0">
            <p className="text-sm font-medium text-cyan-200">Market intelligence</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-5xl">
              See market signals in context.
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-400">
              Explore a sample market snapshot. All products, prices, changes,
              and demand scores below are illustrative examples, not current
              market quotes or buying recommendations.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/dashboard/market-intelligence"
                className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-cyan-300 px-4 text-sm font-semibold text-[#01131a] transition hover:bg-cyan-200"
              >
                Open Market Center
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="min-w-0">
            <div className="grid min-w-0 border-y border-white/[0.08] lg:grid-cols-[1fr_260px]">
              <div className="border-b border-white/[0.08] py-5 lg:border-b-0 lg:border-r lg:pr-6">
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
                          ? "border-cyan-300/40 text-white"
                          : "border-white/[0.09] text-slate-400 hover:text-slate-200",
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
                          ? "border-cyan-300/40 text-cyan-200"
                          : "border-white/[0.09] text-slate-400 hover:text-slate-200",
                      ].join(" ")}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="py-5 lg:pl-6">
                <p className="text-sm font-semibold text-white">{selectedGame.label}</p>
                <p className="mt-1 text-xs text-slate-400">{selectedMode.description}</p>
                <div className="mt-4 grid gap-2 text-xs">
                  <StatusRow label="Source" value="Illustrative sample" />
                  <StatusRow label="Prices" value="Demo values in USD" />
                  <StatusRow label="Availability" value="Interactive preview" />
                </div>
              </div>
            </div>

            <div className="grid min-w-0 gap-8 py-8 lg:grid-cols-[280px_1fr]">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Sample lead signal</p>
                {primaryCard ? (
                  <div className="mt-5 border-y border-white/[0.08] py-5">
                    <p className="text-2xl font-semibold tracking-[-0.035em] text-white">
                      {primaryCard.name}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      {primaryCard.setName} #{primaryCard.collectorNumber}
                    </p>
                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <Metric label="Market" value={currency(primaryCard.marketPrice)} />
                      <Metric label="7D move" value={signedPercent(primaryCard.change7d)} />
                      <Metric label="Demand" value={primaryCard.demand} />
                      <Metric label="Opportunity" value={`${primaryCard.opportunityScore}/100`} />
                    </div>
                  </div>
                ) : (
                  <p className="mt-5 border-y border-white/[0.08] py-5 text-sm leading-6 text-slate-400">
                    No sample available for this selection.
                  </p>
                )}
              </div>

              <div className="min-w-0 overflow-x-auto" role="region" aria-label="Sample market comparison" tabIndex={0}>
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <caption className="sr-only">Illustrative market data. All values are examples.</caption>
                  <thead>
                    <tr className="border-b border-white/[0.08] text-xs text-slate-400">
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
                      <tr key={card.id} className="border-b border-white/[0.055] last:border-b-0">
                        <td className="py-4 pr-6">
                          <p className="text-sm font-semibold text-slate-200">{card.name}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {card.setCode} #{card.collectorNumber}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-400">{currency(card.marketPrice)}</td>
                        <td className={movementClass(card.change24h)}>{signedPercent(card.change24h)}</td>
                        <td className={movementClass(card.change7d)}>{signedPercent(card.change7d)}</td>
                        <td className="px-4 py-4 text-sm text-slate-400">{card.demand}</td>
                        <td className="px-4 py-4 text-sm text-slate-400">{card.source}</td>
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
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-400">{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function movementClass(value: number) {
  return [
    "px-4 py-4 text-sm font-semibold",
    value > 0 ? "text-emerald-300" : value < 0 ? "text-rose-300" : "text-slate-400",
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
