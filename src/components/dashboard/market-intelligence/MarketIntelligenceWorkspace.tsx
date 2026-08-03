"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";

type GameId =
  | "magic"
  | "pokemon"
  | "pokemon-japan"
  | "lorcana"
  | "one-piece";

type MarketCard = {
  id: string;
  game: GameId;
  name: string;
  subtitle: string;
  setName: string;
  image: string;
  marketPrice: number;
  lowPrice: number;
  change24h: number;
  change7d: number;
  inventoryOwned: number;
  potentialRevenue: number;
  demand: "High" | "Medium" | "Low";
};

const GAMES: Array<{
  id: GameId;
  label: string;
}> = [
  { id: "magic", label: "Magic: The Gathering" },
  { id: "pokemon", label: "Pokémon" },
  { id: "pokemon-japan", label: "Pokémon Japan" },
  { id: "lorcana", label: "Disney Lorcana" },
  { id: "one-piece", label: "One Piece" },
];

export function MarketIntelligenceWorkspace() {
  const [activeGame, setActiveGame] =
    useState<GameId>("magic");
  const [games, setGames] =
    useState<Partial<Record<GameId, MarketCard[]>>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    try {
      const response = await fetch(
        "/api/multi-game-market",
        { cache: "no-store" },
      );
      const payload = await response.json();
      setGames(payload.games ?? {});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const cards = games[activeGame] ?? [];

  return (
    <main className="min-h-screen bg-[#020b12] px-5 py-8 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Trading Docks Intelligence
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Multi-Game Market Center
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Compare live card prices, market movement, demand,
              and inventory exposure across the major trading card games.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300/[0.14] bg-cyan-400/[0.04] px-4 text-[9px] font-semibold text-cyan-200"
          >
            <RefreshCw
              className={[
                "h-3.5 w-3.5",
                loading ? "animate-spin" : "",
              ].join(" ")}
            />
            Refresh markets
          </button>
        </header>

        <div className="mt-7 flex gap-2 overflow-x-auto border-y border-white/[0.06] py-4">
          {GAMES.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => setActiveGame(game.id)}
              className={[
                "shrink-0 rounded-xl border px-4 py-2.5 text-[9px] font-semibold",
                activeGame === game.id
                  ? "border-cyan-300/[0.22] bg-cyan-400/[0.06] text-cyan-100"
                  : "border-white/[0.06] bg-white/[0.02] text-slate-600",
              ].join(" ")}
            >
              {game.label}
            </button>
          ))}
        </div>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const positive = card.change7d >= 0;

            return (
              <article
                key={card.id}
                className="rounded-2xl border border-white/[0.07] bg-[#071522] p-4"
              >
                <div className="flex gap-3">
                  <div className="h-[110px] w-[78px] shrink-0 overflow-hidden rounded-xl border border-white/[0.09] bg-cyan-950">
                    {card.image ? (
                      <img
                        src={card.image}
                        alt={card.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {card.name}
                    </p>
                    <p className="mt-1 truncate text-[8px] text-slate-600">
                      {card.setName}
                    </p>
                    <p className="mt-4 text-xl font-semibold">
                      {currency(card.marketPrice)}
                    </p>
                    <p
                      className={[
                        "mt-1 inline-flex items-center gap-1 text-[9px] font-semibold",
                        positive
                          ? "text-emerald-300"
                          : "text-rose-300",
                      ].join(" ")}
                    >
                      {positive ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {signedPercent(card.change7d)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Metric
                    label="Market Low"
                    value={currency(card.lowPrice)}
                  />
                  <Metric
                    label="24 Hour"
                    value={signedPercent(card.change24h)}
                  />
                  <Metric
                    label="Inventory"
                    value={card.inventoryOwned.toString()}
                  />
                  <Metric
                    label="Revenue"
                    value={currency(card.potentialRevenue)}
                  />
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.055] bg-white/[0.015] p-3">
      <p className="text-[7px] uppercase tracking-[0.1em] text-slate-700">
        {label}
      </p>
      <p className="mt-1 text-[9px] font-semibold text-slate-300">
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
