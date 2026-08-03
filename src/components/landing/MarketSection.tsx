"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Flame,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type GameId =
  | "magic"
  | "pokemon"
  | "pokemon-japan"
  | "lorcana"
  | "one-piece";

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
  sourceUrl?: string;
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
  { id: "pokemon", label: "Pokémon", shortLabel: "Pokémon" },
  { id: "pokemon-japan", label: "Pokémon Japan", shortLabel: "Pokémon JP" },
  { id: "lorcana", label: "Disney Lorcana", shortLabel: "Lorcana" },
  { id: "one-piece", label: "One Piece", shortLabel: "One Piece" },
];

const MODES: Array<{
  id: MarketMode;
  label: string;
  description: string;
  icon: typeof TrendingUp;
}> = [
  {
    id: "trending",
    label: "Trending",
    description: "Balanced market signals",
    icon: Flame,
  },
  {
    id: "movers",
    label: "Movers",
    description: "Largest seven-day changes",
    icon: TrendingUp,
  },
  {
    id: "volume",
    label: "Volume",
    description: "Highest demand signals",
    icon: BarChart3,
  },
  {
    id: "opportunities",
    label: "Opportunities",
    description: "Potential acquisition spread",
    icon: Zap,
  },
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
      const response = await fetch("/api/multi-game-market", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Market feed returned ${response.status}.`);
      }

      const nextPayload: ApiResponse = await response.json();
      setPayload(nextPayload);
    } catch (caught) {
      console.error(caught);
      setError("Live market signals are temporarily unavailable.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(() => load(), 300_000);
    return () => window.clearInterval(interval);
  }, []);

  const cards = useMemo(() => {
    const source = payload?.games?.[activeGame] ?? [];
    const sorted = [...source];

    if (activeMode === "movers") {
      return sorted.sort(
        (a, b) => Math.abs(b.change7d) - Math.abs(a.change7d),
      );
    }
    if (activeMode === "volume") {
      return sorted.sort((a, b) => b.volumeScore - a.volumeScore);
    }
    if (activeMode === "opportunities") {
      return sorted.sort(
        (a, b) => b.opportunityScore - a.opportunityScore,
      );
    }

    return sorted.sort((a, b) => {
      const scoreA =
        Math.abs(a.change7d) * 2 +
        a.volumeScore +
        a.opportunityScore * 0.65;
      const scoreB =
        Math.abs(b.change7d) * 2 +
        b.volumeScore +
        b.opportunityScore * 0.65;
      return scoreB - scoreA;
    });
  }, [activeGame, activeMode, payload]);

  const status = payload?.status?.[activeGame];
  const selectedGame =
    GAME_TABS.find((game) => game.id === activeGame) ?? GAME_TABS[0];
  const selectedMode =
    MODES.find((mode) => mode.id === activeMode) ?? MODES[0];

  return (
    <section
      id="market"
      data-td-reveal
      className="relative z-10 overflow-hidden border-y border-white/[0.05] bg-[#020a12]"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[4%] top-[-14rem] h-[34rem] w-[34rem] rounded-full bg-blue-500/[0.1] blur-[145px]" />
        <div className="absolute bottom-[-12rem] right-[8%] h-[28rem] w-[28rem] rounded-full bg-cyan-300/[0.065] blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(100,150,220,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(100,150,220,.02)_1px,transparent_1px)] bg-[size:54px_54px] [mask-image:linear-gradient(to_bottom,black,transparent_95%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12 lg:py-30">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.16] bg-cyan-300/[0.05] px-3.5 py-2 text-xs font-semibold text-cyan-200">
              <Sparkles className="h-4 w-4" />
              Live multi-game market intelligence
            </div>

            <h2 className="mt-6 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
              See what is moving.
              <span className="block bg-gradient-to-r from-cyan-200 via-blue-300 to-blue-500 bg-clip-text text-transparent">
                Spot what matters next.
              </span>
            </h2>

            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-500">
              Explore live reference prices and derived market signals across
              Magic, Pokémon, Pokémon Japan, Lorcana, and One Piece.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => load(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 text-sm font-semibold text-slate-400 transition hover:-translate-y-0.5 hover:border-blue-300/[0.18] hover:text-blue-100"
            >
              <RefreshCw
                className={[
                  "h-4 w-4",
                  refreshing ? "animate-spin" : "",
                ].join(" ")}
              />
              Refresh
            </button>

            <Link
              href="/dashboard/market-intelligence"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-300 px-5 text-sm font-semibold text-[#001018] shadow-[0_14px_40px_rgba(37,99,235,.22)] transition hover:-translate-y-0.5"
            >
              Open Market Center
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mt-10 rounded-[28px] border border-white/[0.075] bg-[#06131e]/92 p-3 shadow-[0_30px_100px_rgba(0,0,0,.3)] backdrop-blur-xl">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {GAME_TABS.map((game) => {
              const active = game.id === activeGame;
              const gameStatus = payload?.status?.[game.id];
              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => setActiveGame(game.id)}
                  className={[
                    "group relative min-w-max flex-1 rounded-2xl border px-4 py-3 text-left transition duration-300",
                    active
                      ? "border-cyan-300/[0.22] bg-gradient-to-r from-blue-500/[0.18] to-cyan-300/[0.055] shadow-[0_14px_38px_rgba(37,99,235,.11)]"
                      : "border-transparent bg-transparent hover:border-white/[0.06] hover:bg-white/[0.025]",
                  ].join(" ")}
                >
                  <span className={active ? "block text-sm font-semibold text-white" : "block text-sm font-semibold text-slate-500 group-hover:text-slate-200"}>
                    {game.shortLabel}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-[11px] text-slate-700">
                    <span
                      className={[
                        "h-1.5 w-1.5 rounded-full",
                        gameStatus?.dataQuality === "live"
                          ? "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.7)]"
                          : gameStatus?.dataQuality === "reference"
                            ? "bg-amber-300"
                            : "bg-slate-600",
                      ].join(" ")}
                    />
                    {gameStatus?.dataQuality === "live"
                      ? "Live feed"
                      : gameStatus?.dataQuality === "reference"
                        ? "Reference feed"
                        : loading
                          ? "Connecting"
                          : "Fallback feed"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[310px_1fr]">
          <aside className="rounded-[26px] border border-white/[0.075] bg-[#06131e]/88 p-3">
            <p className="px-3 pb-3 pt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
              Market view
            </p>

            <div className="space-y-1.5">
              {MODES.map((mode) => {
                const Icon = mode.icon;
                const active = mode.id === activeMode;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setActiveMode(mode.id)}
                    className={[
                      "flex w-full items-center gap-3 rounded-2xl border px-3 py-3.5 text-left transition",
                      active
                        ? "border-cyan-300/[0.18] bg-blue-500/[0.12]"
                        : "border-transparent hover:border-white/[0.06] hover:bg-white/[0.025]",
                    ].join(" ")}
                  >
                    <span className={active ? "flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/[0.09] text-cyan-200" : "flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.025] text-blue-300/55"}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className={active ? "block text-sm font-semibold text-white" : "block text-sm font-semibold text-slate-400"}>
                        {mode.label}
                      </span>
                      <span className="mt-1 block text-xs text-slate-700">
                        {mode.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/[0.12] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white">
                  {selectedGame.label}
                </p>
                <span className="rounded-full border border-white/[0.07] px-2 py-1 text-[10px] font-semibold text-slate-500">
                  {cards.length} cards
                </span>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <StatusRow
                  label="Source"
                  value={status?.source ?? (loading ? "Connecting" : "Unavailable")}
                />
                <StatusRow
                  label="Quality"
                  value={
                    status?.dataQuality === "live"
                      ? "Live"
                      : status?.dataQuality === "reference"
                        ? "Reference"
                        : "Fallback"
                  }
                />
                <StatusRow
                  label="Updated"
                  value={
                    payload?.updatedAt
                      ? new Date(payload.updatedAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "Pending"
                  }
                />
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-300/[0.1] bg-blue-400/[0.03] px-3 py-2.5">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-300" />
                <p className="text-[11px] leading-5 text-slate-600">
                  Prices come from available catalog feeds. Movement, volume,
                  and opportunity scores are Trading Docks market signals.
                </p>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  {selectedMode.label} · {selectedGame.label}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {selectedMode.description}
                </p>
              </div>

              <p className="text-xs text-slate-700">
                Auto-refreshes every 5 minutes
              </p>
            </div>

            <div
              key={`${activeGame}-${activeMode}`}
              className="grid animate-[marketMoverFade_350ms_ease-out] gap-4 md:grid-cols-2"
            >
              {cards.slice(0, 6).map((card, index) => (
                <MarketMoverCard
                  key={`${activeGame}-${activeMode}-${card.id}`}
                  card={card}
                  rank={index + 1}
                  mode={activeMode}
                />
              ))}

              {loading && !cards.length
                ? Array.from({ length: 4 }, (_, index) => (
                    <MarketSkeleton key={index} />
                  ))
                : null}
            </div>

            {!loading && !cards.length ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[28px] border border-white/[0.07] bg-[#06131e] px-6 text-center">
                <BarChart3 className="h-9 w-9 text-blue-300/55" />
                <p className="mt-5 text-lg font-semibold text-white">
                  {error || "No market cards are available yet."}
                </p>
                <p className="mt-2 max-w-md text-sm leading-7 text-slate-600">
                  Refresh the feed or configure a dedicated provider for this
                  game in the market engine.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes marketMoverFade {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.99);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </section>
  );
}

function MarketMoverCard({
  card,
  rank,
  mode,
}: {
  card: MarketCard;
  rank: number;
  mode: MarketMode;
}) {
  const positive = card.change7d >= 0;
  const primaryValue =
    mode === "volume"
      ? `${card.volumeScore}/100`
      : mode === "opportunities"
        ? `${card.opportunityScore}/100`
        : signedPercent(card.change7d);
  const primaryLabel =
    mode === "volume"
      ? "Volume signal"
      : mode === "opportunities"
        ? "Opportunity"
        : "7-day move";

  return (
    <article className="td-spotlight-card group relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#071522]/95 p-5 shadow-[0_25px_80px_rgba(0,0,0,.28)] transition duration-500 hover:-translate-y-1.5 hover:border-blue-300/[0.22] hover:shadow-[0_30px_95px_rgba(37,99,235,.11)]">
      <div className="pointer-events-none absolute right-[-4rem] top-[-5rem] h-44 w-44 rounded-full bg-blue-500/[0.09] blur-[70px]" />

      <div className="relative flex gap-4">
        <CardArtwork card={card} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold tracking-[-0.02em] text-white">
                {card.name}
              </p>
              <p className="mt-1 truncate text-xs text-slate-600">
                {card.setName}
              </p>
            </div>

            <span className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-blue-300/[0.11] bg-blue-400/[0.045] px-2 text-xs font-bold text-blue-200">
              #{rank}
            </span>
          </div>

          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                Market
              </p>
              <p className="mt-1 text-2xl font-bold tracking-[-0.035em] text-white [font-variant-numeric:tabular-nums]">
                {currency(card.marketPrice)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                {primaryLabel}
              </p>
              <p
                className={[
                  "mt-1 inline-flex items-center gap-1 text-sm font-bold",
                  mode === "movers" || mode === "trending"
                    ? positive
                      ? "text-emerald-300"
                      : "text-rose-300"
                    : "text-cyan-200",
                ].join(" ")}
              >
                {mode === "movers" || mode === "trending" ? (
                  positive ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )
                ) : null}
                {primaryValue}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Sparkline
        values={card.sparkline}
        positive={positive}
      />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Metric label="Market low" value={currency(card.lowPrice)} />
        <Metric
          label="24 hour"
          value={signedPercent(card.change24h)}
          tone={card.change24h >= 0 ? "good" : "bad"}
        />
        <Metric label="Demand" value={card.demand} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-700">
            Source
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-400">
            {card.source}
          </p>
        </div>

        <span
          className={[
            "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.09em]",
            card.dataQuality === "live"
              ? "border-emerald-300/[0.13] bg-emerald-300/[0.04] text-emerald-300"
              : card.dataQuality === "reference"
                ? "border-amber-300/[0.13] bg-amber-300/[0.04] text-amber-300"
                : "border-white/[0.08] bg-white/[0.025] text-slate-500",
          ].join(" ")}
        >
          {card.dataQuality}
        </span>
      </div>
    </article>
  );
}

function Sparkline({
  values,
  positive,
}: {
  values: number[];
  positive: boolean;
}) {
  if (!values.length) return null;

  const width = 420;
  const height = 88;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 18) - 9;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.05] bg-black/[0.12] px-2 py-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Seven-day price signal"
        className="h-[74px] w-full overflow-visible"
      >
        <defs>
          <linearGradient id={`spark-${positive ? "up" : "down"}`} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={positive ? "rgb(103 232 249)" : "rgb(253 164 175)"}
              stopOpacity="0.25"
            />
            <stop
              offset="100%"
              stopColor={positive ? "rgb(59 130 246)" : "rgb(244 63 94)"}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <polyline
          points={`0,${height} ${points} ${width},${height}`}
          fill={`url(#spark-${positive ? "up" : "down"})`}
          stroke="none"
        />
        <polyline
          points={points}
          fill="none"
          stroke={positive ? "rgb(103 232 249)" : "rgb(253 164 175)"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function CardArtwork({ card }: { card: MarketCard }) {
  const [failed, setFailed] = useState(false);

  const initials = useMemo(
    () =>
      card.name
        .split(/\s+/)
        .slice(0, 3)
        .map((word) => word.charAt(0))
        .join(""),
    [card.name],
  );

  useEffect(() => {
    setFailed(false);
  }, [card.image]);

  return (
    <div className="relative h-[132px] w-[94px] shrink-0 overflow-hidden rounded-xl border border-white/[0.12] bg-gradient-to-br from-blue-950 to-slate-950 shadow-[0_14px_35px_rgba(0,0,0,.3)]">
      {card.image && !failed ? (
        <img
          src={card.image}
          alt={`${card.name} — ${card.setName}`}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center px-2 text-center">
          <span className="text-lg font-bold text-blue-200">{initials}</span>
          <span className="mt-2 text-[9px] text-slate-600">
            Image unavailable
          </span>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "bad";
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.055] bg-white/[0.018] px-3 py-3">
      <p className="truncate text-[9px] font-semibold uppercase tracking-[0.09em] text-slate-700">
        {label}
      </p>
      <p
        className={[
          "mt-1.5 truncate text-xs font-bold [font-variant-numeric:tabular-nums]",
          tone === "good"
            ? "text-emerald-300"
            : tone === "bad"
              ? "text-rose-300"
              : "text-slate-300",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-700">{label}</span>
      <span className="truncate font-semibold text-slate-400">{value}</span>
    </div>
  );
}

function MarketSkeleton() {
  return (
    <div className="h-[430px] animate-pulse rounded-[26px] border border-white/[0.055] bg-[#06131e] p-5">
      <div className="flex gap-4">
        <div className="h-[132px] w-[94px] rounded-xl bg-white/[0.035]" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-3/4 rounded bg-white/[0.04]" />
          <div className="h-3 w-1/2 rounded bg-white/[0.025]" />
          <div className="mt-6 h-7 w-1/3 rounded bg-white/[0.04]" />
        </div>
      </div>
      <div className="mt-5 h-[90px] rounded-xl bg-white/[0.025]" />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="h-14 rounded-xl bg-white/[0.025]" />
        <div className="h-14 rounded-xl bg-white/[0.025]" />
        <div className="h-14 rounded-xl bg-white/[0.025]" />
      </div>
    </div>
  );
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
