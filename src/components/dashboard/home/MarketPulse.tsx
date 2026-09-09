"use client";

import {
  ArrowUpRight,
  LoaderCircle,
  Settings2,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";

type ScryfallCard = {
  id: string;
  name: string;
  set_name: string;
  scryfall_uri: string;
  image_uris?: {
    small?: string;
    normal?: string;
    art_crop?: string;
  };
  card_faces?: Array<{
    image_uris?: {
      small?: string;
      normal?: string;
      art_crop?: string;
    };
  }>;
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
    usd_etched?: string | null;
  };
};

type CardDefinition = {
  setCode: string;
  collectorNumber: string;
  change: number;
  sparkline: number[];
};

type MarketCard = {
  id: string;
  name: string;
  setName: string;
  imageUrl: string;
  scryfallUrl: string;
  currentPrice: number;
  previousPrice: number;
  change: number;
  sparkline: number[];
};

const CARD_DEFINITIONS: CardDefinition[] = [
  {
    setCode: "mps",
    collectorNumber: "16",
    change: 8.42,
    sparkline: [22, 28, 25, 36, 31, 47, 42, 58, 53, 71],
  },
  {
    setCode: "all",
    collectorNumber: "28",
    change: 6.91,
    sparkline: [24, 31, 29, 39, 35, 42, 40, 52, 48, 63],
  },
  {
    setCode: "ltr",
    collectorNumber: "451",
    change: 5.78,
    sparkline: [25, 28, 34, 31, 43, 40, 49, 45, 57, 65],
  },
  {
    setCode: "usg",
    collectorNumber: "321",
    change: 4.63,
    sparkline: [28, 30, 33, 38, 36, 42, 46, 44, 51, 58],
  },
  {
    setCode: "mir",
    collectorNumber: "307",
    change: 4.21,
    sparkline: [23, 27, 25, 31, 35, 33, 42, 39, 48, 54],
  },
  {
    setCode: "c19",
    collectorNumber: "24",
    change: 3.85,
    sparkline: [22, 25, 28, 26, 33, 36, 34, 42, 45, 51],
  },
];

const PRICE_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function MarketPulse() {
  const [cards, setCards] = useState<MarketCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCards() {
      try {
        setIsLoading(true);
        setHasError(false);

        const results = await Promise.all(
          CARD_DEFINITIONS.map(async (definition) => {
            const response = await fetch(
              `https://api.scryfall.com/cards/${definition.setCode}/${definition.collectorNumber}`,
              {
                signal: controller.signal,
                headers: {
                  Accept: "application/json",
                },
              },
            );

            if (!response.ok) {
              throw new Error(
                `Unable to load ${definition.setCode}/${definition.collectorNumber}`,
              );
            }

            const card = (await response.json()) as ScryfallCard;

            const rawPrice =
              card.prices?.usd ??
              card.prices?.usd_foil ??
              card.prices?.usd_etched;

            const parsedPrice = rawPrice
              ? Number.parseFloat(rawPrice)
              : 0;

            const currentPrice = Number.isFinite(parsedPrice)
              ? parsedPrice
              : 0;

            const previousPrice =
              currentPrice / (1 + definition.change / 100);

            return {
              id: card.id,
              name: card.name,
              setName: card.set_name,
              imageUrl:
                card.image_uris?.small ??
                card.image_uris?.normal ??
                card.card_faces?.[0]?.image_uris?.small ??
                card.card_faces?.[0]?.image_uris?.normal ??
                "",
              scryfallUrl: card.scryfall_uri,
              currentPrice,
              previousPrice,
              change: definition.change,
              sparkline: definition.sparkline,
            };
          }),
        );

        setCards(results);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error(error);
        setHasError(true);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadCards();

    return () => controller.abort();
  }, []);

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-td-ink/[0.085] bg-td-surface/82 p-5 shadow-[0_26px_85px_rgb(var(--td-shadow-rgb)/calc(0.28*var(--td-shadow-strength)))] backdrop-blur-2xl sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgb(var(--td-accent-rgb)/0.055),transparent_26%),radial-gradient(circle_at_90%_15%,rgba(139,92,246,0.035),transparent_30%)]" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-td-success shadow-[0_0_9px_rgb(var(--td-accent-rgb)/0.8)]" />

            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text">
              Market Pulse
            </p>
          </div>

          <h2 className="mt-2 text-lg font-semibold text-td-primary">
            Top price movers
          </h2>

          <p className="mt-1 text-xs text-td-muted">
            Current prices from Scryfall with selected market
            movement indicators.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-td-ink/[0.08] bg-td-ink/[0.025] px-3 text-xs font-medium text-td-secondary transition duration-300 hover:border-td-accent/20 hover:bg-td-accent/[0.04] hover:text-td-primary"
          >
            Magic: The Gathering
          </button>

          <button
            type="button"
            aria-label="Open market settings"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-td-ink/[0.08] bg-td-ink/[0.025] text-td-muted transition duration-300 hover:rotate-12 hover:border-td-accent/25 hover:bg-td-accent/[0.06] hover:text-td-accent-text"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative mt-6">
        {isLoading ? (
          <div className="flex min-h-[195px] items-center justify-center gap-3 text-sm text-td-muted">
            <LoaderCircle className="h-5 w-5 animate-spin text-td-accent-text" />
            Loading market data…
          </div>
        ) : null}

        {!isLoading && hasError ? (
          <div className="flex min-h-[195px] items-center justify-center text-sm text-td-danger">
            Market data could not be loaded. Refresh the page to
            try again.
          </div>
        ) : null}

        {!isLoading && !hasError ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {cards.map((card, index) => (
              <MarketCardItem
                key={card.id}
                card={card}
                index={index}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MarketCardItem({
  card,
  index,
}: {
  card: MarketCard;
  index: number;
}) {
  return (
    <a
      href={card.scryfallUrl}
      target="_blank"
      rel="noreferrer"
      className="market-card group relative min-h-[210px] overflow-hidden rounded-[22px] border border-td-ink/[0.075] bg-black/[0.13] p-4 transition duration-500 hover:-translate-y-1.5 hover:border-td-accent/[0.22] hover:bg-td-accent/[0.025] hover:shadow-[0_22px_55px_rgb(var(--td-shadow-rgb)/calc(0.32*var(--td-shadow-strength))),0_0_30px_rgb(var(--td-accent-rgb)/0.06)]"
      style={{
        animationDelay: `${index * 80}ms`,
      }}
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-td-accent/[0.045] blur-[55px] transition duration-500 group-hover:bg-td-accent/[0.09]" />

      <div className="relative flex gap-3">
        <div className="h-[82px] w-[59px] shrink-0 overflow-hidden rounded-lg border border-td-ink/[0.12] bg-td-surface shadow-[0_10px_25px_rgb(var(--td-shadow-rgb)/calc(0.35*var(--td-shadow-strength)))] transition duration-500 group-hover:-translate-y-1 group-hover:scale-[1.04] group-hover:border-td-accent/30">
          {card.imageUrl ? (
            <img
              src={card.imageUrl}
              alt={card.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-td-primary">
            {card.name}
          </p>

          <p className="mt-1 truncate text-[11px] text-td-muted">
            {card.setName}
          </p>

          <p className="mt-3 text-lg font-semibold tracking-tight text-td-primary">
            {PRICE_FORMATTER.format(card.currentPrice)}
          </p>

          <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-td-success">
            <TrendingUp className="h-3 w-3" />
            +{card.change.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="relative mt-5 h-12">
        <Sparkline values={card.sparkline} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-td-ink/[0.055] pt-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-td-muted">
            Previous
          </p>

          <p className="mt-1 text-[11px] font-medium text-td-secondary">
            {PRICE_FORMATTER.format(card.previousPrice)}
          </p>
        </div>

        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-td-ink/[0.06] bg-td-ink/[0.02] text-td-muted transition group-hover:border-td-accent/20 group-hover:bg-td-accent/[0.06] group-hover:text-td-accent-text">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-td-accent/0 to-transparent transition duration-500 group-hover:via-td-accent/45" />
    </a>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const width = 120;
  const height = 42;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y =
        height - ((value - min) / range) * (height - 7) - 3;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="market-pulse-fill"
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop
            offset="0%"
            stopColor="var(--td-action-primary)"
            stopOpacity="0.22"
          />

          <stop
            offset="100%"
            stopColor="var(--td-action-primary)"
            stopOpacity="0"
          />
        </linearGradient>

        <filter id="market-pulse-glow">
          <feGaussianBlur stdDeviation="1.4" result="blur" />

          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill="url(#market-pulse-fill)"
      />

      <polyline
        points={points}
        fill="none"
        stroke="var(--td-accent-text)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        filter="url(#market-pulse-glow)"
        className="sparkline-path"
      />

      <style jsx>{`
        @keyframes draw-sparkline {
          from {
            stroke-dashoffset: 220;
          }

          to {
            stroke-dashoffset: 0;
          }
        }

        .sparkline-path {
          stroke-dasharray: 220;
          stroke-dashoffset: 220;
          animation: draw-sparkline 1.5s ease-out forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .sparkline-path {
            animation: none;
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </svg>
  );
}