"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { MarketCardArtwork } from "./MarketCardArtwork";
import { GAME_TABS, sampleCards, selectFeaturedCard, rankCards, artworkIssues, artworkLayoutIssues, warnArtworkIssues, type MarketMode } from "@/lib/card-artwork/demo-market-artwork";
import type { ArtworkGame } from "@/lib/card-artwork/providers";

const MODES: Array<{ id: MarketMode; label: string; description: string }> = [
  { id: "trending", label: "Balanced signal", description: "Movement plus demand" },
  { id: "movers", label: "Price movement", description: "Largest seven-day changes" },
  { id: "volume", label: "Demand", description: "Highest volume signals" },
  { id: "opportunities", label: "Spread", description: "Potential acquisition margin" },
];

export function MarketSection() {
  const [activeGame, setActiveGame] = useState<ArtworkGame>("magic");
  const [activeMode, setActiveMode] = useState<MarketMode>("trending");
  const selectedGame = GAME_TABS.find((game) => game.id === activeGame)!;
  const selectedMode = MODES.find((mode) => mode.id === activeMode)!;
  const cards = useMemo(() => rankCards(sampleCards(activeGame), activeMode), [activeGame, activeMode]);
  const primaryCard = selectFeaturedCard(cards);
  const visibleCards = cards.filter((card) => artworkIssues(card).length === 0);
  warnArtworkIssues(artworkLayoutIssues(cards, primaryCard ? "normal" : "preview"));

  return (
    <section id="market" aria-label="Market intelligence" className="relative z-10 border-y border-td-ink/[0.06] bg-td-surface px-5 py-14 text-td-primary sm:px-8 sm:py-16 lg:px-12">
      <div className="mx-auto max-w-[1240px]">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-td-accent-text">03 / Market intelligence</p>
        <h2 className="mt-4 text-4xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-5xl">See market signals in context.</h2>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-td-secondary">Explore real card printings with sample market signals. Prices, changes, and demand scores below are illustrative examples, not current market quotes or buying recommendations.</p>
        <Link href="/dashboard/market-intelligence" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-td-accent px-4 text-sm font-semibold text-td-on-accent transition hover:bg-td-accent-hover">Open Market Center<ArrowRight className="h-4 w-4" /></Link>

        <div className="mt-8 grid min-w-0 border-y border-td-ink/[0.08] lg:grid-cols-[1fr_240px]">
          <div className="border-b border-td-ink/[0.08] py-5 lg:border-b-0 lg:border-r lg:pr-6">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Card games">
              {GAME_TABS.map((game) => <button key={game.id} type="button" onClick={() => setActiveGame(game.id)} aria-pressed={activeGame === game.id} className={tabClass(activeGame === game.id)}>{game.shortLabel}</button>)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Market signals">
              {MODES.map((mode) => <button key={mode.id} type="button" onClick={() => setActiveMode(mode.id)} aria-pressed={activeMode === mode.id} className={tabClass(activeMode === mode.id)}>{mode.label}</button>)}
            </div>
          </div>
          <div className="py-5 lg:pl-6">
            <p className="text-sm font-semibold">{selectedGame.label}</p>
            <p className="mt-1 text-xs text-td-secondary">{selectedMode.description}</p>
            <p className="mt-4 text-xs leading-6 text-td-muted">Illustrative sample · Demo values in USD<br />Interactive preview · Real card artwork</p>
          </div>
        </div>

        {primaryCard ? <div className="grid min-w-0 gap-8 py-8 lg:grid-cols-[240px_minmax(0,1fr)]" data-artwork-mode="normal">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Sample lead signal</p>
            <div className="mt-5 flex items-start gap-5 lg:block">
              <div className="w-[140px] shrink-0 sm:w-[180px] lg:mb-5 lg:w-[210px]"><MarketCardArtwork card={primaryCard} variant="featured" /></div>
              <div className="min-w-0 flex-1">
                <p className="break-words text-xl font-semibold tracking-[-0.035em] sm:text-2xl">{primaryCard.name}</p>
                <p className="mt-2 break-words text-xs leading-5 text-td-secondary">{primaryCard.setName} · {primaryCard.collectorNumber}</p>
                <p className="mt-1 text-xs text-td-muted">{primaryCard.language} printing</p>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Metric label="Market · demo" value={currency(primaryCard.marketPrice)} />
                  <Metric label="7D move" value={signedPercent(primaryCard.change7d)} />
                  <Metric label="Demand" value={primaryCard.demand} />
                  <Metric label="Opportunity" value={`${primaryCard.opportunityScore}/100`} />
                </div>
                <p className="mt-5 border-t border-td-ink/10 pt-4 text-xs font-semibold text-td-accent-text">Suggested action · {primaryCard.suggestedAction}</p>
              </div>
            </div>
          </div>

          <div className="min-w-0" role="region" aria-label="Sample market comparison">
            <table className="w-full table-fixed border-collapse text-left">
              <caption className="sr-only">Illustrative market data. All values are examples.</caption>
              <thead><tr className="border-b border-td-ink/[0.08] text-xs text-td-secondary">
                <th className="w-[52%] py-3 pr-2 font-medium sm:w-[40%]">Product</th>
                <th className="px-1 py-3 font-medium sm:px-2">Market</th>
                <th className="hidden px-2 py-3 font-medium sm:table-cell">24h</th>
                <th className="px-1 py-3 font-medium sm:px-2">7d</th>
                <th className="hidden px-2 py-3 font-medium md:table-cell">Demand</th>
              </tr></thead>
              <tbody>{visibleCards.map((card) => <tr key={card.id} className="border-b border-td-ink/[0.055] last:border-b-0">
                <td className="py-4 pr-2"><div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <MarketCardArtwork card={card} variant="thumbnail" />
                  <div className="min-w-0 break-words"><p className="text-sm font-semibold">{card.name}</p><p className="mt-1 text-xs text-td-secondary">{card.setCode} · {card.collectorNumber}</p></div>
                </div></td>
                <td className="px-1 py-4 text-xs tabular-nums text-td-secondary sm:px-2 sm:text-sm">{currency(card.marketPrice)}</td>
                <td className={`hidden sm:table-cell ${movementClass(card.change24h)}`}>{signedPercent(card.change24h)}</td>
                <td className={movementClass(card.change7d)}>{signedPercent(card.change7d)}</td>
                <td className="hidden px-2 py-4 text-sm text-td-secondary md:table-cell">{card.demand}</td>
              </tr>)}</tbody>
            </table>
            <p className="mt-5 text-xs leading-6 text-td-muted">Illustrative sample · Values in USD, not live market quotes.</p>
            <a href={primaryCard.providerCardUrl ?? undefined} target="_blank" rel="noreferrer" className="mt-2 block text-xs leading-6 text-td-secondary underline decoration-td-ink/20 underline-offset-4">{primaryCard.attributionLabel}</a>
          </div>
        </div> : <div className="my-8 flex flex-wrap items-center justify-between gap-5 border-y border-td-ink/10 py-8" data-artwork-mode="preview">
          <div><p className="text-lg font-semibold">{selectedGame.label} collection preview</p><p className="mt-2 max-w-xl text-sm leading-6 text-td-secondary">We’re curating this collection. Explore another game’s card artwork and sample signals in the meantime.</p></div>
          <button type="button" onClick={() => setActiveGame("magic")} className="text-sm font-semibold text-td-accent-text">Explore Magic →</button>
        </div>}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-td-secondary">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums">{value}</p></div>;
}
function tabClass(selected: boolean) {
  return `min-h-10 border px-3 py-2 text-sm transition ${selected ? "border-td-accent/40 text-td-accent-text" : "border-td-ink/[0.09] text-td-secondary hover:text-td-primary"}`;
}
function movementClass(value: number) {
  return `px-1 py-4 text-xs font-semibold tabular-nums sm:px-2 sm:text-sm ${value > 0 ? "text-td-success" : value < 0 ? "text-td-danger" : "text-td-secondary"}`;
}
function currency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value); }
function signedPercent(value: number) { return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`; }
