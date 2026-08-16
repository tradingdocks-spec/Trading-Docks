"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";

type GameId = "magic" | "pokemon" | "pokemon-japan" | "lorcana" | "one-piece";
type MarketMode = "trending" | "movers" | "volume" | "opportunities";

type MarketCard = {
  id: string;
  game: GameId;
  name: string;
  subtitle: string;
  setName: string;
  setCode: string;
  collectorNumber: string;
  image: string;
  marketPrice: number;
  lowPrice: number;
  change24h: number;
  change7d: number;
  inventoryOwned: number;
  potentialRevenue: number;
  demand: "High" | "Medium" | "Low";
  volumeScore: number;
  opportunityScore: number;
  sparkline: number[];
  source: string;
  dataQuality: "live" | "reference" | "fallback";
  signal: "gainer" | "loser" | "volume" | "opportunity";
};

type GameStatus = {
  game: GameId;
  label: string;
  source: string;
  dataQuality: "live" | "reference" | "fallback";
  cardCount: number;
};

type ApiResponse = {
  updatedAt: string;
  refreshSeconds: number;
  games: Record<GameId, MarketCard[]>;
  status: Record<GameId, GameStatus>;
};

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
  const [payload, setPayload] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(manual = false) {
    manual ? setRefreshing(true) : setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/multi-game-market", { cache: "no-store" });
      if (!response.ok) throw new Error(`Market feed returned ${response.status}.`);
      const nextPayload = (await response.json()) as ApiResponse;
      setPayload(nextPayload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Market feed unavailable.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load(false);
  }, []);

  const selectedGame = GAME_TABS.find((game) => game.id === activeGame) ?? GAME_TABS[0];
  const selectedMode = MODES.find((mode) => mode.id === activeMode) ?? MODES[0];
  const status = payload?.status?.[activeGame];
  const cards = useMemo(
    () => rankCards(payload?.games?.[activeGame] ?? [], activeMode),
    [activeGame, activeMode, payload],
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
              Product movement, not a fake stock ticker.
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-500">
              The market view keeps source quality visible and turns price
              movement into inventory decisions: buy, hold, reprice, list, or
              investigate.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => load(true)}
                className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-white/[0.12] px-4 text-sm font-semibold text-slate-200 transition hover:border-cyan-200/35 hover:text-white"
              >
                <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Refresh feed
              </button>
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
                      className={[
                        "h-9 border px-3 text-sm transition",
                        activeGame === game.id
                          ? "border-cyan-300/40 text-white"
                          : "border-white/[0.09] text-slate-500 hover:text-slate-200",
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
                      className={[
                        "h-9 border px-3 text-sm transition",
                        activeMode === mode.id
                          ? "border-cyan-300/40 text-cyan-200"
                          : "border-white/[0.09] text-slate-500 hover:text-slate-200",
                      ].join(" ")}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="py-5 lg:pl-6">
                <p className="text-sm font-semibold text-white">{selectedGame.label}</p>
                <p className="mt-1 text-xs text-slate-600">{selectedMode.description}</p>
                <div className="mt-4 grid gap-2 text-xs">
                  <StatusRow label="Source" value={status?.source ?? (loading ? "Connecting" : "Unavailable")} />
                  <StatusRow label="Quality" value={status?.dataQuality ?? "fallback"} />
                  <StatusRow label="Updated" value={formatUpdated(payload?.updatedAt)} />
                </div>
              </div>
            </div>

            {error ? (
              <div className="border-b border-white/[0.08] py-5 text-sm text-rose-300">
                {error}
              </div>
            ) : null}

            <div className="grid min-w-0 gap-8 py-8 lg:grid-cols-[280px_1fr]">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Lead signal</p>
                {primaryCard ? (
                  <div className="mt-5 border-y border-white/[0.08] py-5">
                    <p className="text-2xl font-semibold tracking-[-0.035em] text-white">
                      {primaryCard.name}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
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
                  <p className="mt-5 border-y border-white/[0.08] py-5 text-sm leading-6 text-slate-600">
                    {loading ? "Connecting to market feed." : "No market signal available for this selection."}
                  </p>
                )}
              </div>

              <div className="min-w-0 overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-xs text-slate-600">
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
                          <p className="mt-1 text-xs text-slate-600">
                            {card.setCode} #{card.collectorNumber}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-400">{currency(card.marketPrice)}</td>
                        <td className={movementClass(card.change24h)}>{signedPercent(card.change24h)}</td>
                        <td className={movementClass(card.change7d)}>{signedPercent(card.change7d)}</td>
                        <td className="px-4 py-4 text-sm text-slate-500">{card.demand}</td>
                        <td className="px-4 py-4 text-sm text-slate-500">{card.source}</td>
                      </tr>
                    ))}
                    {loading && !cards.length ? (
                      <tr>
                        <td className="py-8 text-sm text-slate-600" colSpan={6}>
                          Loading market intelligence.
                        </td>
                      </tr>
                    ) : null}
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
      <span className="text-slate-700">{label}</span>
      <span className="text-slate-400">{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-700">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function movementClass(value: number) {
  return [
    "px-4 py-4 text-sm font-semibold",
    value > 0 ? "text-emerald-300" : value < 0 ? "text-rose-300" : "text-slate-500",
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

function formatUpdated(value: string | undefined) {
  if (!value) return "Pending";
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
