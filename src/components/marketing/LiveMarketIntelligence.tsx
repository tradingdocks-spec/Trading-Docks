"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";

type MarketCard = {
  key: string;
  name: string;
  setName: string;
  image: string;
  price: number;
  change: number;
  history: number[];
};

const MARKET_CARDS: MarketCard[] = [
  {
    key: "cavern-of-souls",
    name: "Cavern of Souls",
    setName: "Lost Caverns of Ixalan",
    image: "/market-cards/mana-crypt.jpg",
    price: 47.8,
    change: 1.34,
    history: [44, 45, 44, 46, 47, 46, 48, 49, 48, 50],
  },
  {
    key: "rhystic-study",
    name: "Rhystic Study",
    setName: "Wilds of Eldraine",
    image: "/market-cards/force-of-will.jpg",
    price: 31.25,
    change: -0.82,
    history: [33, 34, 33, 32, 33, 32, 31, 31, 30, 31],
  },
  {
    key: "the-one-ring",
    name: "The One Ring",
    setName: "Tales of Middle-earth",
    image: "/market-cards/the-one-ring.jpg",
    price: 82.4,
    change: 0.46,
    history: [79, 80, 81, 81, 82, 81, 82, 83, 82, 82],
  },
  {
    key: "sheoldred",
    name: "Sheoldred, the Apocalypse",
    setName: "Dominaria United",
    image: "/market-cards/underground-sea.jpg",
    price: 63.1,
    change: -1.18,
    history: [66, 65, 64, 64, 63, 62, 63, 62, 61, 61],
  },
];

export function LiveMarketIntelligence() {
  return (
    <section className="bg-td-canvas px-5 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1420px]">
        <header className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-td-accent-text">
            Live Market Intelligence
          </p>

          <h2 className="mx-auto mt-5 max-w-[760px] text-4xl font-semibold leading-[0.98] tracking-[-0.045em] text-td-primary sm:text-5xl lg:text-[58px]">
            Understand what is moving—and why.
          </h2>

          <p className="mx-auto mt-6 max-w-[760px] text-sm leading-6 text-td-muted sm:text-base">
            Use current market context to prioritize inventory, pricing,
            purchasing, and listing decisions.
          </p>
        </header>

        <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {MARKET_CARDS.map((card) => (
            <MarketCardTile key={card.key} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MarketCardTile({ card }: { card: MarketCard }) {
  const isPositive = card.change >= 0;

  return (
    <article className="overflow-hidden rounded-[24px] border border-td-line/45 bg-td-surface p-5 shadow-[0_22px_60px_rgb(var(--td-shadow-rgb)/calc(0.18*var(--td-shadow-strength)))]">
      <div className="flex min-w-0 gap-4">
        <LocalCardImage card={card} />

        <div className="min-w-0 flex-1 pt-1">
          <h3 className="truncate text-sm font-semibold text-td-primary">
            {card.name}
          </h3>

          <p className="mt-2 truncate text-[11px] text-td-muted">
            {card.setName}
          </p>

          <p className="mt-5 text-xl font-semibold tracking-[-0.025em] text-td-primary">
            {currency(card.price)}
          </p>

          <div
            className={[
              "mt-2 inline-flex items-center gap-1 text-[11px] font-semibold",
              isPositive ? "text-td-success" : "text-td-danger",
            ].join(" ")}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {isPositive ? "+" : ""}
            {card.change.toFixed(2)}%
          </div>
        </div>
      </div>

      <Sparkline values={card.history} positive={isPositive} />
    </article>
  );
}

function LocalCardImage({ card }: { card: MarketCard }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative h-[92px] w-[66px] shrink-0 overflow-hidden rounded-xl border border-td-line/55 bg-td-surface">
      {!failed ? (
        <img
          src={card.image}
          alt={`${card.name} — ${card.setName}`}
          width={146}
          height={204}
          loading="eager"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <CardPlaceholder name={card.name} />
      )}
    </div>
  );
}

function CardPlaceholder({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 3)
    .map((word) => word.charAt(0))
    .join("");

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-td-accent to-td-canvas px-1 text-center">
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-td-accent/25 bg-td-accent/[0.06] text-[11px] font-semibold text-td-accent-text">
        {initials}
      </span>
      <span className="mt-2 line-clamp-2 text-[11px] leading-3 text-td-muted">
        Run image download script
      </span>
    </div>
  );
}

function Sparkline({
  values,
  positive,
}: {
  values: number[];
  positive: boolean;
}) {
  const points = useMemo(() => {
    const width = 286;
    const height = 54;
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const spread = Math.max(1, maximum - minimum);

    return values
      .map((value, index) => {
        const x =
          values.length === 1
            ? width / 2
            : (index / (values.length - 1)) * width;
        const y =
          height -
          ((value - minimum) / spread) * (height - 8) -
          4;

        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [values]);

  return (
    <svg
      viewBox="0 0 286 54"
      aria-hidden="true"
      className="mt-7 h-[54px] w-full overflow-visible"
    >
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "var(--td-success)" : "var(--td-danger)"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

