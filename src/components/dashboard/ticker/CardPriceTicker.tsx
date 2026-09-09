"use client";

import {
  ChevronRight,
  LoaderCircle,
  Settings2,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type GameId =
  | "magic"
  | "pokemon"
  | "lorcana"
  | "one-piece"
  | "yugioh"
  | "sports";

type ScryfallCard = {
  id: string;
  name: string;
  set_name: string;
  collector_number: string;
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

type TickerCardDefinition = {
  set: string;
  collectorNumber: string;
  fallbackPrice: number;
  percentageChange: number;
};

type TickerCard = {
  id: string;
  name: string;
  setName: string;
  imageUrl: string;
  scryfallUrl: string;
  currentPrice: number;
  previousPrice: number;
  percentageChange: number;
};

type GameOption = {
  id: GameId;
  label: string;
  abbreviation: string;
  available: boolean;
};

const CARD_DEFINITIONS: TickerCardDefinition[] = [
  {
    set: "mps",
    collectorNumber: "16",
    fallbackPrice: 164.72,
    percentageChange: 8.42,
  },
  {
    set: "all",
    collectorNumber: "28",
    fallbackPrice: 98.31,
    percentageChange: 6.91,
  },
  {
    set: "ltr",
    collectorNumber: "451",
    fallbackPrice: 143.78,
    percentageChange: 5.78,
  },
  {
    set: "usg",
    collectorNumber: "321",
    fallbackPrice: 768.41,
    percentageChange: 4.63,
  },
  {
    set: "mir",
    collectorNumber: "307",
    fallbackPrice: 271.5,
    percentageChange: 4.21,
  },
  {
    set: "c19",
    collectorNumber: "24",
    fallbackPrice: 87.16,
    percentageChange: 3.85,
  },
];

const GAME_OPTIONS: GameOption[] = [
  {
    id: "magic",
    label: "Magic: The Gathering",
    abbreviation: "MTG",
    available: true,
  },
  {
    id: "pokemon",
    label: "Pokémon",
    abbreviation: "PKM",
    available: false,
  },
  {
    id: "lorcana",
    label: "Disney Lorcana",
    abbreviation: "LOR",
    available: false,
  },
  {
    id: "one-piece",
    label: "One Piece",
    abbreviation: "OP",
    available: false,
  },
  {
    id: "yugioh",
    label: "Yu-Gi-Oh!",
    abbreviation: "YGO",
    available: false,
  },
  {
    id: "sports",
    label: "Sports Cards",
    abbreviation: "SPT",
    available: false,
  },
];

const PRICE_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getCardImage(card: ScryfallCard): string {
  return (
    card.image_uris?.small ??
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.small ??
    card.card_faces?.[0]?.image_uris?.normal ??
    ""
  );
}

function getCardPrice(
  card: ScryfallCard,
  fallbackPrice: number,
): number {
  const rawPrice =
    card.prices?.usd ??
    card.prices?.usd_foil ??
    card.prices?.usd_etched;

  const parsedPrice = rawPrice ? Number.parseFloat(rawPrice) : NaN;

  return Number.isFinite(parsedPrice)
    ? parsedPrice
    : fallbackPrice;
}

function calculatePreviousPrice(
  currentPrice: number,
  percentageChange: number,
): number {
  return currentPrice / (1 + percentageChange / 100);
}

async function fetchCard(
  definition: TickerCardDefinition,
  signal: AbortSignal,
): Promise<TickerCard> {
  const response = await fetch(
    `https://api.scryfall.com/cards/${definition.set}/${definition.collectorNumber}`,
    {
      signal,
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Scryfall request failed for ${definition.set}/${definition.collectorNumber}.`,
    );
  }

  const card = (await response.json()) as ScryfallCard;
  const currentPrice = getCardPrice(
    card,
    definition.fallbackPrice,
  );

  return {
    id: card.id,
    name: card.name,
    setName: card.set_name,
    imageUrl: getCardImage(card),
    scryfallUrl: card.scryfall_uri,
    currentPrice,
    previousPrice: calculatePreviousPrice(
      currentPrice,
      definition.percentageChange,
    ),
    percentageChange: definition.percentageChange,
  };
}

export default function CardPriceTicker() {
  const [cards, setCards] = useState<TickerCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] =
    useState(false);
  const [selectedGames, setSelectedGames] = useState<GameId[]>([
    "magic",
  ]);
  const [tickerSpeed, setTickerSpeed] = useState(42);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCards() {
      try {
        setIsLoading(true);
        setHasError(false);

        const loadedCards = await Promise.all(
          CARD_DEFINITIONS.map((definition) =>
            fetchCard(definition, controller.signal),
          ),
        );

        setCards(loadedCards);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error("Unable to load ticker cards:", error);
        setHasError(true);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadCards();

    return () => {
      controller.abort();
    };
  }, []);

  const tickerCards = useMemo(() => {
    if (!selectedGames.includes("magic")) {
      return [];
    }

    return [...cards, ...cards];
  }, [cards, selectedGames]);

  function toggleGame(game: GameOption) {
    if (!game.available) {
      return;
    }

    setSelectedGames((currentGames) => {
      if (currentGames.includes(game.id)) {
        return currentGames.filter(
          (gameId) => gameId !== game.id,
        );
      }

      return [...currentGames, game.id];
    });
  }

  return (
    <>
      <section className="ticker-shell">
        <div className="ticker-heading">
          <div>
            <p className="ticker-eyebrow">Price movers</p>
            <p className="ticker-subtitle">
              Live market updates
            </p>
          </div>

          <div className="ticker-game-label">MTG</div>
        </div>

        <div className="ticker-viewport">
          {isLoading ? (
            <div className="ticker-state">
              <LoaderCircle className="ticker-spinner" />
              Loading real card data…
            </div>
          ) : null}

          {!isLoading && hasError ? (
            <div className="ticker-state ticker-error">
              Scryfall data could not be loaded. Check your
              internet connection and refresh the page.
            </div>
          ) : null}

          {!isLoading &&
          !hasError &&
          tickerCards.length === 0 ? (
            <div className="ticker-state">
              Select Magic: The Gathering in ticker settings to
              display these cards.
            </div>
          ) : null}

          {!isLoading &&
          !hasError &&
          tickerCards.length > 0 ? (
            <div
              className="ticker-track"
              style={{
                animationDuration: `${tickerSpeed}s`,
              }}
            >
              {tickerCards.map((card, index) => (
                <TickerItem
                  key={`${card.id}-${index}`}
                  card={card}
                />
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="ticker-settings-button"
          aria-label="Open ticker settings"
          onClick={() => setIsSettingsOpen(true)}
        >
          <Settings2 />
        </button>

        <div className="ticker-fade ticker-fade-left" />
        <div className="ticker-fade ticker-fade-right" />
      </section>

      {isSettingsOpen ? (
        <TickerSettings
          selectedGames={selectedGames}
          tickerSpeed={tickerSpeed}
          onClose={() => setIsSettingsOpen(false)}
          onToggleGame={toggleGame}
          onTickerSpeedChange={setTickerSpeed}
        />
      ) : null}

      <style jsx global>{`
        @keyframes trading-docks-ticker-scroll {
          from {
            transform: translate3d(0, 0, 0);
          }

          to {
            transform: translate3d(-50%, 0, 0);
          }
        }

        @keyframes trading-docks-ticker-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes trading-docks-ticker-enter {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.98);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .ticker-shell {
          position: relative;
          display: grid;
          grid-template-columns: 154px minmax(0, 1fr) 54px;
          min-height: 84px;
          overflow: hidden;
          border: 1px solid rgb(var(--td-accent-rgb)/0.18);
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 15% 0%,
              rgb(var(--td-accent-rgb)/0.055),
              transparent 31%
            ),
            linear-gradient(
              135deg,
              rgb(var(--td-surface-rgb)/0.96),
              rgb(var(--td-surface-rgb)/0.97)
            );
          box-shadow:
            0 22px 70px rgb(var(--td-shadow-rgb)/calc(0.3*var(--td-shadow-strength))),
            inset 0 1px rgb(var(--td-ink-rgb)/0.025);
          transition:
            border-color 300ms ease,
            box-shadow 300ms ease;
        }

        .ticker-shell:hover {
          border-color: rgb(var(--td-accent-rgb)/0.3);
          box-shadow:
            0 25px 80px rgb(var(--td-shadow-rgb)/calc(0.36*var(--td-shadow-strength))),
            0 0 35px rgb(var(--td-accent-rgb)/0.05),
            inset 0 1px rgb(var(--td-ink-rgb)/0.035);
        }

        .ticker-shell::before {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          content: "";
          background: linear-gradient(
            90deg,
            rgb(var(--td-accent-rgb)/0.035),
            transparent 26%,
            transparent 75%,
            rgba(139, 92, 246, 0.025)
          );
        }

        .ticker-shell::after {
          position: absolute;
          top: 0;
          right: 9%;
          left: 9%;
          height: 1px;
          content: "";
          background: linear-gradient(
            90deg,
            transparent,
            rgb(var(--td-accent-rgb)/0.46),
            transparent
          );
        }

        .ticker-heading {
          position: relative;
          z-index: 4;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 8px;
          padding: 15px 16px 15px 20px;
          border-right: 1px solid rgb(var(--td-ink-rgb)/0.065);
          background: rgb(var(--td-surface-rgb)/0.92);
        }

        .ticker-eyebrow {
          margin: 0;
          color: rgb(103, 232, 249);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.16em;
          line-height: 1;
          text-transform: uppercase;
        }

        .ticker-subtitle {
          margin: 0;
          color: rgb(71, 85, 105);
          font-size: 10px;
        }

        .ticker-game-label {
          width: fit-content;
          padding: 4px 8px;
          border: 1px solid rgb(var(--td-accent-rgb)/0.15);
          border-radius: 7px;
          background: rgb(var(--td-accent-rgb)/0.05);
          color: rgb(165, 243, 252);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .ticker-viewport {
          position: relative;
          z-index: 1;
          min-width: 0;
          overflow: hidden;
        }

        .ticker-track {
          display: flex;
          width: max-content;
          height: 100%;
          animation-name: trading-docks-ticker-scroll;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
        }

        .ticker-viewport:hover .ticker-track {
          animation-play-state: paused;
        }

        .ticker-item {
          position: relative;
          display: grid;
          grid-template-columns: 40px minmax(120px, 1fr) 58px;
          align-items: center;
          width: 248px;
          min-width: 248px;
          gap: 11px;
          padding: 11px 15px;
          border-right: 1px solid rgb(var(--td-ink-rgb)/0.055);
          color: inherit;
          text-decoration: none;
          transition:
            background 250ms ease,
            box-shadow 250ms ease;
        }

        .ticker-item:hover {
          z-index: 6;
          background: rgb(var(--td-accent-rgb)/0.05);
          box-shadow:
            inset 0 -1px rgb(var(--td-accent-rgb)/0.14),
            0 0 32px rgb(var(--td-accent-rgb)/0.05);
        }

        .ticker-card-image-frame {
          position: relative;
          width: 38px;
          height: 53px;
          overflow: hidden;
          border: 1px solid rgb(var(--td-ink-rgb)/0.14);
          border-radius: 6px;
          background: rgb(7, 17, 26);
          box-shadow: 0 8px 18px rgb(var(--td-shadow-rgb)/calc(0.38*var(--td-shadow-strength)));
          transition:
            transform 280ms ease,
            border-color 280ms ease,
            box-shadow 280ms ease;
        }

        .ticker-item:hover .ticker-card-image-frame {
          transform: translateY(-2px) scale(1.06);
          border-color: rgb(var(--td-accent-rgb)/0.4);
          box-shadow:
            0 12px 26px rgb(var(--td-shadow-rgb)/calc(0.48*var(--td-shadow-strength))),
            0 0 18px rgb(var(--td-accent-rgb)/0.12);
        }

        .ticker-card-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .ticker-card-copy {
          min-width: 0;
        }

        .ticker-card-name {
          overflow: hidden;
          margin: 0;
          color: rgb(241, 245, 249);
          font-size: 11px;
          font-weight: 650;
          line-height: 1.25;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ticker-card-set {
          overflow: hidden;
          margin: 4px 0 0;
          color: rgb(71, 85, 105);
          font-size: 8px;
          line-height: 1.2;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ticker-card-price {
          margin: 6px 0 0;
          color: rgb(226, 232, 240);
          font-size: 11px;
          font-weight: 650;
        }

        .ticker-card-change {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 3px;
          color: rgb(52, 211, 153);
          font-size: 9px;
          font-weight: 700;
        }

        .ticker-card-change svg {
          width: 11px;
          height: 11px;
        }

        .ticker-hover-details {
          position: absolute;
          right: 12px;
          bottom: calc(100% + 8px);
          z-index: 20;
          width: 190px;
          padding: 13px;
          visibility: hidden;
          border: 1px solid rgb(var(--td-accent-rgb)/0.2);
          border-radius: 14px;
          background: rgb(var(--td-surface-rgb)/0.98);
          box-shadow:
            0 22px 60px rgb(var(--td-shadow-rgb)/calc(0.5*var(--td-shadow-strength))),
            0 0 28px rgb(var(--td-accent-rgb)/0.07);
          opacity: 0;
          transform: translateY(6px);
          transition:
            opacity 180ms ease,
            transform 180ms ease,
            visibility 180ms ease;
          pointer-events: none;
        }

        .ticker-item:hover .ticker-hover-details {
          visibility: visible;
          opacity: 1;
          transform: translateY(0);
        }

        .ticker-hover-title {
          margin: 0 0 11px;
          color: rgb(148, 163, 184);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .ticker-hover-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 7px;
          color: rgb(100, 116, 139);
          font-size: 10px;
        }

        .ticker-hover-row strong {
          color: rgb(226, 232, 240);
          font-weight: 650;
        }

        .ticker-hover-row-current strong {
          color: rgb(52, 211, 153);
        }

        .ticker-state {
          display: flex;
          height: 100%;
          min-height: 82px;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 20px;
          color: rgb(100, 116, 139);
          font-size: 11px;
        }

        .ticker-error {
          color: rgb(251, 113, 133);
        }

        .ticker-spinner {
          width: 17px;
          height: 17px;
          animation: trading-docks-ticker-spin 800ms linear
            infinite;
          color: rgb(34, 211, 238);
        }

        .ticker-settings-button {
          position: relative;
          z-index: 5;
          display: flex;
          width: 38px;
          height: 38px;
          align-items: center;
          justify-content: center;
          align-self: center;
          justify-self: center;
          border: 1px solid rgb(var(--td-accent-rgb)/0.17);
          border-radius: 12px;
          background: rgb(var(--td-accent-rgb)/0.055);
          color: rgb(148, 163, 184);
          cursor: pointer;
          transition:
            color 250ms ease,
            border-color 250ms ease,
            background 250ms ease,
            box-shadow 250ms ease,
            transform 250ms ease;
        }

        .ticker-settings-button:hover {
          transform: translateY(-1px) rotate(12deg);
          border-color: rgb(var(--td-accent-rgb)/0.38);
          background: rgb(var(--td-accent-rgb)/0.1);
          color: rgb(103, 232, 249);
          box-shadow: 0 0 24px rgb(var(--td-accent-rgb)/0.11);
        }

        .ticker-settings-button svg {
          width: 17px;
          height: 17px;
        }

        .ticker-fade {
          position: absolute;
          top: 0;
          bottom: 0;
          z-index: 3;
          width: 42px;
          pointer-events: none;
        }

        .ticker-fade-left {
          left: 154px;
          background: linear-gradient(
            90deg,
            rgb(4, 14, 23),
            transparent
          );
        }

        .ticker-fade-right {
          right: 53px;
          background: linear-gradient(
            270deg,
            rgb(4, 14, 23),
            transparent
          );
        }

        .ticker-settings-backdrop {
          position: fixed;
          inset: 0;
          z-index: 90;
          background: rgb(var(--td-surface-rgb)/0.48);
          backdrop-filter: blur(5px);
        }

        .ticker-settings-panel {
          position: fixed;
          top: 86px;
          right: 24px;
          z-index: 100;
          width: min(360px, calc(100vw - 32px));
          overflow: hidden;
          border: 1px solid rgb(var(--td-accent-rgb)/0.23);
          border-radius: 20px;
          background:
            radial-gradient(
              circle at 100% 0%,
              rgb(var(--td-accent-rgb)/0.07),
              transparent 32%
            ),
            rgb(var(--td-surface-rgb)/0.98);
          box-shadow:
            0 30px 100px rgb(var(--td-shadow-rgb)/calc(0.65*var(--td-shadow-strength))),
            0 0 40px rgb(var(--td-accent-rgb)/0.06);
          animation: trading-docks-ticker-enter 220ms ease-out
            both;
        }

        .ticker-settings-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 20px;
          border-bottom: 1px solid rgb(var(--td-ink-rgb)/0.065);
        }

        .ticker-settings-header h2 {
          margin: 0;
          color: rgb(241, 245, 249);
          font-size: 14px;
          font-weight: 700;
        }

        .ticker-settings-header p {
          margin: 6px 0 0;
          color: rgb(100, 116, 139);
          font-size: 10px;
          line-height: 1.5;
        }

        .ticker-close-button {
          display: flex;
          width: 31px;
          height: 31px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgb(var(--td-ink-rgb)/0.075);
          border-radius: 9px;
          background: rgb(var(--td-ink-rgb)/0.025);
          color: rgb(100, 116, 139);
          cursor: pointer;
          transition: 200ms ease;
        }

        .ticker-close-button:hover {
          border-color: rgb(var(--td-accent-rgb)/0.2);
          color: rgb(226, 232, 240);
        }

        .ticker-close-button svg {
          width: 15px;
          height: 15px;
        }

        .ticker-settings-content {
          padding: 10px 20px 20px;
        }

        .ticker-game-option {
          display: flex;
          width: 100%;
          align-items: center;
          gap: 11px;
          padding: 12px 0;
          border: 0;
          border-bottom: 1px solid rgb(var(--td-ink-rgb)/0.05);
          background: transparent;
          color: inherit;
          text-align: left;
        }

        button.ticker-game-option {
          cursor: pointer;
        }

        .ticker-game-option-disabled {
          cursor: not-allowed;
          opacity: 0.48;
        }

        .ticker-game-icon {
          display: flex;
          width: 30px;
          height: 30px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgb(var(--td-accent-rgb)/0.12);
          border-radius: 9px;
          background: rgb(var(--td-accent-rgb)/0.04);
          color: rgb(165, 243, 252);
          font-size: 8px;
          font-weight: 750;
        }

        .ticker-game-name {
          flex: 1;
          color: rgb(203, 213, 225);
          font-size: 11px;
          font-weight: 550;
        }

        .ticker-game-status {
          color: rgb(71, 85, 105);
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .ticker-game-checkbox {
          display: flex;
          width: 18px;
          height: 18px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgb(var(--td-accent-rgb)/0.35);
          border-radius: 5px;
          background: rgb(var(--td-ink-rgb)/0.02);
          color: transparent;
        }

        .ticker-game-checkbox-active {
          border-color: rgb(var(--td-accent-rgb)/0.5);
          background: rgb(34, 211, 238);
          color: rgb(2, 12, 19);
        }

        .ticker-game-checkbox svg {
          width: 12px;
          height: 12px;
        }

        .ticker-speed-section {
          padding-top: 20px;
        }

        .ticker-speed-section label {
          display: block;
          margin-bottom: 11px;
          color: rgb(203, 213, 225);
          font-size: 11px;
          font-weight: 650;
        }

        .ticker-speed-section input {
          width: 100%;
          accent-color: rgb(34, 211, 238);
        }

        .ticker-speed-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 7px;
          color: rgb(71, 85, 105);
          font-size: 8px;
        }

        .ticker-save-button {
          display: flex;
          width: 100%;
          height: 42px;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 20px;
          border: 1px solid rgb(var(--td-accent-rgb)/0.25);
          border-radius: 12px;
          background: rgb(var(--td-accent-rgb)/0.08);
          color: rgb(207, 250, 254);
          cursor: pointer;
          font-size: 11px;
          font-weight: 650;
          transition: 250ms ease;
        }

        .ticker-save-button:hover {
          transform: translateY(-1px);
          border-color: rgb(var(--td-accent-rgb)/0.43);
          background: rgb(var(--td-accent-rgb)/0.14);
          box-shadow: 0 0 24px rgb(var(--td-accent-rgb)/0.08);
        }

        .ticker-save-button svg {
          width: 14px;
          height: 14px;
        }

        @media (max-width: 900px) {
          .ticker-shell {
            grid-template-columns: 115px minmax(0, 1fr) 48px;
          }

          .ticker-heading {
            padding-left: 14px;
          }

          .ticker-fade-left {
            left: 115px;
          }

          .ticker-fade-right {
            right: 47px;
          }
        }

        @media (max-width: 640px) {
          .ticker-shell {
            grid-template-columns: minmax(0, 1fr) 48px;
          }

          .ticker-heading {
            display: none;
          }

          .ticker-fade-left {
            left: 0;
          }

          .ticker-item {
            width: 225px;
            min-width: 225px;
          }

          .ticker-settings-panel {
            top: auto;
            right: 16px;
            bottom: 16px;
            left: 16px;
            width: auto;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ticker-track {
            animation-play-state: paused;
          }

          .ticker-spinner {
            animation-duration: 1.5s;
          }
        }
      `}</style>
    </>
  );
}

function TickerItem({ card }: { card: TickerCard }) {
  return (
    <a
      className="ticker-item"
      href={card.scryfallUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`View ${card.name} on Scryfall`}
    >
      <div className="ticker-card-image-frame">
        {card.imageUrl ? (
          <img
            className="ticker-card-image"
            src={card.imageUrl}
            alt={card.name}
            loading="lazy"
          />
        ) : null}
      </div>

      <div className="ticker-card-copy">
        <p className="ticker-card-name">{card.name}</p>
        <p className="ticker-card-set">{card.setName}</p>
        <p className="ticker-card-price">
          {PRICE_FORMATTER.format(card.currentPrice)}
        </p>
      </div>

      <div className="ticker-card-change">
        <TrendingUp />
        {card.percentageChange.toFixed(2)}%
      </div>

      <div className="ticker-hover-details">
        <p className="ticker-hover-title">
          Price movement
        </p>

        <div className="ticker-hover-row">
          <span>Previous price</span>
          <strong>
            {PRICE_FORMATTER.format(card.previousPrice)}
          </strong>
        </div>

        <div className="ticker-hover-row ticker-hover-row-current">
          <span>Current price</span>
          <strong>
            {PRICE_FORMATTER.format(card.currentPrice)}
          </strong>
        </div>

        <div className="ticker-hover-row ticker-hover-row-current">
          <span>Increase</span>
          <strong>
            +{card.percentageChange.toFixed(2)}%
          </strong>
        </div>
      </div>
    </a>
  );
}

type TickerSettingsProps = {
  selectedGames: GameId[];
  tickerSpeed: number;
  onClose: () => void;
  onToggleGame: (game: GameOption) => void;
  onTickerSpeedChange: (speed: number) => void;
};

function TickerSettings({
  selectedGames,
  tickerSpeed,
  onClose,
  onToggleGame,
  onTickerSpeedChange,
}: TickerSettingsProps) {
  return (
    <>
      <button
        type="button"
        className="ticker-settings-backdrop"
        aria-label="Close ticker settings"
        onClick={onClose}
      />

      <aside
        className="ticker-settings-panel"
        aria-label="Ticker settings"
      >
        <div className="ticker-settings-header">
          <div>
            <h2>Ticker settings</h2>
            <p>
              Select the games represented in your market
              ticker.
            </p>
          </div>

          <button
            type="button"
            className="ticker-close-button"
            aria-label="Close settings"
            onClick={onClose}
          >
            <X />
          </button>
        </div>

        <div className="ticker-settings-content">
          {GAME_OPTIONS.map((game) => {
            const isSelected = selectedGames.includes(game.id);

            return (
              <button
                key={game.id}
                type="button"
                className={[
                  "ticker-game-option",
                  !game.available
                    ? "ticker-game-option-disabled"
                    : "",
                ].join(" ")}
                disabled={!game.available}
                onClick={() => onToggleGame(game)}
              >
                <span className="ticker-game-icon">
                  {game.abbreviation}
                </span>

                <span className="ticker-game-name">
                  {game.label}
                </span>

                {!game.available ? (
                  <span className="ticker-game-status">
                    API needed
                  </span>
                ) : (
                  <span
                    className={[
                      "ticker-game-checkbox",
                      isSelected
                        ? "ticker-game-checkbox-active"
                        : "",
                    ].join(" ")}
                  >
                    <ChevronRight />
                  </span>
                )}
              </button>
            );
          })}

          <div className="ticker-speed-section">
            <label htmlFor="ticker-speed">
              Ticker speed
            </label>

            <input
              id="ticker-speed"
              type="range"
              min="24"
              max="70"
              step="1"
              value={tickerSpeed}
              onChange={(event) =>
                onTickerSpeedChange(
                  Number.parseInt(event.target.value, 10),
                )
              }
            />

            <div className="ticker-speed-labels">
              <span>Fast</span>
              <span>Normal</span>
              <span>Slow</span>
            </div>
          </div>

          <button
            type="button"
            className="ticker-save-button"
            onClick={onClose}
          >
            Save preferences
            <ChevronRight />
          </button>
        </div>
      </aside>
    </>
  );
}