"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";

type GameId =
  | "magic"
  | "pokemon"
  | "lorcana"
  | "one-piece";

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
};

type ApiResponse = {
  updatedAt: string;
  refreshSeconds: number;
  games: Record<GameId, MarketCard[]>;
};

const GAME_TABS: Array<{
  id: GameId;
  label: string;
}> = [
  { id: "magic", label: "Magic" },
  { id: "pokemon", label: "Pokémon" },
  { id: "lorcana", label: "Lorcana" },
  { id: "one-piece", label: "One Piece" },
];

export function MarketSection() {
  const [activeGame, setActiveGame] =
    useState<GameId>("magic");
  const [data, setData] =
    useState<Partial<Record<GameId, MarketCard[]>>>({});
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    try {
      const response = await fetch(
        "/api/multi-game-market",
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("Market movers unavailable.");
      }

      const payload: ApiResponse = await response.json();
      setData(payload.games);
      setUpdatedAt(payload.updatedAt);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 300_000);
    return () => window.clearInterval(interval);
  }, []);

  const cards = data[activeGame] ?? [];

  return (
    <section
      id="market"
      className="relative z-10 mx-auto w-full max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12 lg:py-28"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#20e7ff]">
            Market Movers
          </p>

          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            See what is moving across the TCG market.
          </h2>

          <p className="mt-5 max-w-2xl text-base leading-7 text-[#8296aa]">
            Live card prices and market movement across Magic,
            Pokémon, Lorcana, and One Piece—without turning the
            landing page into a full trading terminal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 text-[9px] font-semibold text-slate-500 transition hover:text-blue-200"
          >
            <RefreshCw
              className={[
                "h-3.5 w-3.5",
                loading ? "animate-spin" : "",
              ].join(" ")}
            />
            Refresh
          </button>

          <Link
            href="/dashboard/market-intelligence"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-300 px-4 text-[9px] font-semibold text-[#001018]"
          >
            Open Market Center
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 border-y border-white/[0.06] py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto">
          {GAME_TABS.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => setActiveGame(game.id)}
              className={[
                "shrink-0 rounded-xl border px-4 py-2.5 text-[10px] font-semibold transition",
                activeGame === game.id
                  ? "border-blue-300/[0.25] bg-blue-400/[0.07] text-blue-100"
                  : "border-white/[0.07] bg-white/[0.02] text-slate-600 hover:text-slate-300",
              ].join(" ")}
            >
              {game.label}
            </button>
          ))}
        </div>

        <p className="text-[8px] text-slate-700">
          {updatedAt
            ? `Updated ${new Date(updatedAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}`
            : "Retrieving live market data"}
        </p>
      </div>

      <div
        key={activeGame}
        className="mt-5 grid animate-[marketMoverFade_350ms_ease-out] gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        {cards.map((card) => (
          <MarketMoverCard
            key={`${activeGame}-${card.id}`}
            card={card}
          />
        ))}

        {loading && !cards.length
          ? Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-[290px] animate-pulse rounded-[24px] border border-white/[0.05] bg-white/[0.02]"
              />
            ))
          : null}
      </div>

      <style jsx global>{`
        @keyframes marketMoverFade {
          from {
            opacity: 0;
            transform: translateY(7px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}

function MarketMoverCard({
  card,
}: {
  card: MarketCard;
}) {
  const positive = card.change7d >= 0;

  return (
    <article className="group relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#071522]/85 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)] transition duration-500 hover:-translate-y-2 hover:border-blue-300/[0.22] hover:shadow-[0_28px_85px_rgba(0,216,242,0.1)]">
      <div className="flex gap-4">
        <CardArtwork card={card} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {card.name}
          </p>

          <p className="mt-1 truncate text-[9px] text-slate-600">
            {card.setName}
          </p>

          <div className="mt-4 flex items-end justify-between gap-2">
            <div>
              <p className="text-[7px] uppercase tracking-[0.12em] text-slate-700">
                Market
              </p>
              <p className="mt-1 text-xl font-semibold text-white">
                {currency(card.marketPrice)}
              </p>
            </div>

            <div
              className={
                positive
                  ? "text-emerald-300"
                  : "text-rose-300"
              }
            >
              <p className="text-[7px] uppercase tracking-[0.12em] opacity-70">
                7 day
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold">
                {positive ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {signedPercent(card.change7d)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Metric
          label="Market Low"
          value={currency(card.lowPrice)}
        />
        <Metric
          label="24 Hour"
          value={signedPercent(card.change24h)}
          tone={card.change24h >= 0 ? "good" : "bad"}
        />
        <Metric
          label="Demand"
          value={card.demand}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.055] pt-4">
        <div>
          <p className="text-[7px] uppercase tracking-[0.12em] text-slate-700">
            You Own
          </p>
          <p className="mt-1 text-[10px] font-semibold text-slate-300">
            {card.inventoryOwned}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[7px] uppercase tracking-[0.12em] text-slate-700">
            Potential Revenue
          </p>
          <p className="mt-1 text-[11px] font-semibold text-blue-200">
            {currency(card.potentialRevenue)}
          </p>
        </div>
      </div>
    </article>
  );
}

function CardArtwork({
  card,
}: {
  card: MarketCard;
}) {
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
    <div className="relative h-[104px] w-[74px] shrink-0 overflow-hidden rounded-xl border border-white/[0.1] bg-gradient-to-br from-blue-950 to-slate-950">
      {card.image && !failed ? (
        <img
          src={card.image}
          alt={`${card.name} — ${card.setName}`}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.07]"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center px-1 text-center">
          <span className="text-sm font-semibold text-blue-200">
            {initials}
          </span>
          <span className="mt-1 text-[6px] text-slate-600">
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
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-2.5 py-2.5">
      <p className="truncate text-[6px] uppercase tracking-[0.1em] text-slate-800">
        {label}
      </p>

      <p
        className={[
          "mt-1 truncate text-[8px] font-semibold",
          tone === "good"
            ? "text-emerald-300"
            : tone === "bad"
              ? "text-rose-300"
              : "text-slate-400",
        ].join(" ")}
      >
        {value}
      </p>
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
