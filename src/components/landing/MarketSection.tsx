"use client";

import Link from "next/link";
import { memo, useMemo, useRef, useState } from "react";
import { ArrowRight, Pause, Play } from "lucide-react";
import { MarketCardArtwork } from "./MarketCardArtwork";
import { useDemoMarketTicks } from "./useDemoMarketTicks";
import { GAME_TABS, selectFeaturedCard, artworkIssues, artworkLayoutIssues, warnArtworkIssues, type MarketMode } from "@/lib/card-artwork/demo-market-artwork";
import { createDemoMarketCards, rankPreviewCards as rankCards, formatMarketValue, formatMovePercent, formatGain, type PreviewCard } from "@/lib/market-preview";
import type { ArtworkGame } from "@/lib/card-artwork/providers";
import styles from "./MarketPreview.module.css";

const MODES: Array<{ id: MarketMode; label: string; description: string; column: string }> = [
  { id: "trending", label: "Balanced signal", description: "Find the next move for your copies.", column: "Opportunity & action" },
  { id: "movers", label: "Price movement", description: "Follow the biggest shifts in the demo market.", column: "Price movement" },
  { id: "volume", label: "Demand", description: "Put demand beside the inventory you own.", column: "Demand & position" },
  { id: "opportunities", label: "Spread", description: "Compare demo bids and asks before acting.", column: "Bid / ask spread" },
];

export function MarketSection() {
  const [activeGame, setActiveGame] = useState<ArtworkGame>("magic");
  const [activeMode, setActiveMode] = useState<MarketMode>("trending");
  const [paused, setPaused] = useState(false);
  return <section id="market" aria-label="Market intelligence" className="relative z-10 border-y border-td-ink/[0.06] bg-td-surface px-5 py-14 text-td-primary sm:px-8 sm:py-16 lg:px-12">
    <div className="mx-auto max-w-[1240px]">
      <div className={styles.sectionHeading}>
        <div><p className={styles.eyebrow}>03 / Market intelligence</p><h2 className="mt-4 text-4xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-5xl">See market signals in context.</h2><p className="mt-5 max-w-2xl text-sm leading-7 text-td-secondary">Cards move. Your next decision comes into focus. Explore changing quotes, the copies you own, and the signals behind a move.</p></div>
        <Link href="/dashboard/market-intelligence" className={styles.openLink}>Open Market Center<ArrowRight size={16} /></Link>
      </div>
      <div className={styles.gameTabs} role="group" aria-label="Card games">{GAME_TABS.map((game) => <button key={game.id} type="button" onClick={() => setActiveGame(game.id)} aria-pressed={activeGame === game.id} className={styles.tab}>{game.shortLabel}</button>)}</div>
      <MarketFeed key={activeGame} game={activeGame} mode={activeMode} onModeChange={setActiveMode} paused={paused} onTogglePaused={() => setPaused((value) => !value)} />
    </div>
  </section>;
}

function MarketFeed({ game, mode, onModeChange, paused, onTogglePaused }: { game: ArtworkGame; mode: MarketMode; onModeChange: (mode: MarketMode) => void; paused: boolean; onTogglePaused: () => void }) {
  const [ranking, setRanking] = useState(() => rankCards(createDemoMarketCards(game), mode).map((card) => card.id));
  const regionRef = useRef<HTMLDivElement>(null);
  const feed = useDemoMarketTicks(game, regionRef, paused);
  const selectedMode = MODES.find((entry) => entry.id === mode)!;
  // Snapshot the ranking on selection so quote updates never move a row under the reader.
  const cards = useMemo(() => ranking.map((id) => feed.cards.find((card) => card.id === id)!), [feed.cards, ranking]);
  const focusId = selectFeaturedCard(cards)?.id;
  const primary = cards.find((card) => card.id === focusId && artworkIssues(card, true).length === 0);
  const visibleCards = cards.filter((card) => artworkIssues(card).length === 0);
  warnArtworkIssues(artworkLayoutIssues(cards, primary ? "normal" : "preview"));
  const positionValue = cards.reduce((total, card) => total + card.marketPrice * card.owned, 0);
  return <div ref={regionRef} data-feed-tick={feed.tick} data-feed-running={feed.running} className={styles.terminal}>
    <div className={styles.feedBar}>
      <div className={styles.feedLabel}><span className={styles.statusDot} data-running={feed.running} aria-hidden="true" /><strong>Interactive demo</strong><span>Simulated movement · USD</span></div>
      <button type="button" className={styles.pause} aria-pressed={paused} disabled={feed.reducedMotion} onClick={onTogglePaused}>{paused ? <Play size={12} /> : <Pause size={12} />}{feed.reducedMotion ? "Reduced motion · paused" : paused ? "Resume movement" : "Pause movement"}</button>
    </div>
    <div className={styles.signalBar}><div className={styles.signalTabs} role="group" aria-label="Market signals">{MODES.map((entry) => <button key={entry.id} type="button" onClick={() => { onModeChange(entry.id); setRanking(rankCards(feed.cards, entry.id).map((card) => card.id)); }} aria-pressed={mode === entry.id} className={styles.tab}>{entry.label}</button>)}</div><p className={styles.modeDescription}>{selectedMode.description}</p></div>
    {primary ? <div data-artwork-mode="normal" className={styles.workspace}>
      <aside className={styles.focus} aria-label="Featured demo signal" data-featured-id={primary.id}>
        <div className={styles.focusHeading}><span className={styles.eyebrow}>Signal focus</span><span className={styles.micro}>{primary.tick ? "Quote revised · demo" : "Opening snapshot"}</span></div>
        <div className={styles.featureIdentity}>
          <div className={styles.featureArtwork}><MarketCardArtwork card={primary} variant="featured" /></div>
          <div className={styles.featureQuote}><h3>{primary.name}</h3><p className={styles.micro}>{primary.setName} · {primary.collectorNumber}<br />{primary.language} printing</p><p className={styles.quoteLabel}>Market · demo</p><div className={styles.bigPrice} data-feature-price={primary.marketPrice}><TickValue value={formatMarketValue(primary.marketPrice)} updated={primary.tick > 0} /><TickDirection direction={primary.direction} /></div><p className={`${styles.move} ${tone(primary.change7d)}`}>{formatMovePercent(primary.change7d)} <span className={styles.micro}>7d</span></p></div>
        </div>
        <div className={styles.featureChart}><Sparkline card={primary} /><div className={styles.chartAxis}><span>7 days ago · demo</span><span>Current demo quote</span></div></div>
        <div className={styles.focusMetrics} data-feature-emphasis={mode}>
          {mode === "trending" ? <><div><Metric label="Opportunity" value={`${primary.opportunityScore}/100`} /><Meter value={primary.opportunityScore} label="Demo opportunity" /></div><Metric label="Ready to list" value={`${primary.owned - primary.listed} copies`} /></>
            : mode === "movers" ? <><Metric label="24h movement" value={formatMovePercent(primary.change24h)} /><Metric label="7d movement" value={formatMovePercent(primary.change7d)} /></>
            : mode === "volume" ? <><Metric label="Demand strength" value={`${primary.volumeScore}/100`} /><Metric label="30d sell-through · demo" value={`${primary.sellThrough.toFixed(1)}%`} /></>
            : <><Metric label="Bid · demo" value={formatMarketValue(primary.bid)} /><Metric label={`Ask · ${primary.spreadPercent.toFixed(1)}% spread`} value={formatMarketValue(primary.ask)} /></>}
        </div>
        <div className={styles.position}><p className={styles.eyebrow}>Your position · demo</p><div className={styles.positionGrid}><Metric label="Owned" value={`${primary.owned} copies`} /><Metric label="Listed" value={`${primary.listed} copies`} /><Metric label="Average cost" value={formatMarketValue(primary.averageCost)} /><Metric label="Unrealized gain / loss" value={formatGain(primary.unrealized)} className={tone(primary.unrealized)} /></div></div>
        <div className={styles.actionReason}><Action card={primary} /><p>{primary.reason}</p><span className={styles.micro}>Illustrative signal, not a trading recommendation.</span></div>
      </aside>
      <div className={styles.comparison} role="region" aria-label="Sample market comparison">
        <div className={styles.comparisonHeading}><div><p className={styles.eyebrow}>{GAME_TABS.find((entry) => entry.id === game)?.label}</p><h3>{selectedMode.column}</h3></div><div className={styles.positionTotal}><span className={styles.micro}>Position value · demo</span><strong>{formatMarketValue(positionValue)}</strong></div></div>
        <div className={styles.columnHead} aria-hidden="true"><span>Card / position</span><span>Market · USD</span><span>{selectedMode.column}</span></div>
        <ol className={styles.rows} aria-label={`${selectedMode.label} demo signals`}>{visibleCards.map((card) => <MarketRow key={card.id} card={card} mode={mode} latest={card.updatedAtTick > 0 && card.updatedAtTick === feed.tick} />)}</ol>
        <div className={styles.readingNote}><span className={styles.eyebrow}>How to read this view</span><p>{mode === "trending" ? "Opportunity blends demand, spread, seven-day movement and unlisted copies. The action is tied to the position you own." : mode === "movers" ? "Ranked by absolute movement, weighted toward the last 24 hours. The path shows a fictional seven-day history." : mode === "volume" ? "Demand strength and a fictional 30-day sell-through rate put liquidity beside your owned and listed copies." : "Ranked by the gap between a demo bid and ask. A wider spread invites review; it does not guarantee a profit."}</p></div>
        <p className={styles.disclosure}>Ranking refreshes when you select a view. Illustrative sample: prices, movement, demand and positions are simulated. Artwork depicts real card printings.</p>
        <a href={primary.providerCardUrl ?? undefined} target="_blank" rel="noreferrer" className={styles.attribution}>{primary.attributionLabel}</a>
      </div>
    </div> : <div data-artwork-mode="preview" className={styles.empty}>This collection preview is being curated. Explore another game’s artwork and demo signals.</div>}
  </div>;
}

const MarketRow = memo(function MarketRow({ card, mode, latest }: { card: PreviewCard; mode: MarketMode; latest: boolean }) {
  return <li className={styles.row} data-card-id={card.id} data-quote={card.marketPrice} data-updated={latest}><article className={styles.rowContent} aria-label={`${card.name} demo signal`}>
    <div className={styles.rowIdentity}><MarketCardArtwork card={card} variant="thumbnail" /><div><h4>{card.name}</h4><p className={styles.micro}>{card.setCode} · {card.collectorNumber}</p><p className={styles.micro}>{card.owned} owned · {card.listed} listed</p></div></div>
    <div className={styles.rowQuote}><span className={styles.mobileLabel}>Market · demo</span><strong><TickValue value={formatMarketValue(card.marketPrice)} updated={card.tick > 0} /><TickDirection direction={card.direction} /></strong><span className={styles.micro}>{latest ? "Quote revised" : "Demo quote"}</span></div>
    <div className={styles.rowSignal} data-row-emphasis={mode}>
      {mode === "trending" ? <><span className={styles.micro}>Opportunity <strong>{card.opportunityScore}/100</strong></span><Meter value={card.opportunityScore} label={`${card.name} demo opportunity`} /><Action card={card} /></>
        : mode === "movers" ? <><div className={styles.rowMoves}><span className={tone(card.change24h)}>{formatMovePercent(card.change24h)} <small>24h</small></span><span className={tone(card.change7d)}>{formatMovePercent(card.change7d)} <small>7d</small></span></div><Sparkline card={card} compact /></>
        : mode === "volume" ? <><strong>{card.demand} <span className={styles.micro}>{card.volumeScore}/100</span></strong><Meter value={card.volumeScore} label={`${card.name} demo demand`} /><span className={styles.micro}>{card.sellThrough.toFixed(1)}% sell-through · 30d demo</span></>
        : <><div className={styles.bidAsk}><span><small>Bid</small>{formatMarketValue(card.bid)}</span><span><small>Ask</small>{formatMarketValue(card.ask)}</span></div><span className={styles.micro}>{card.spreadPercent.toFixed(1)}% demo spread</span></>}
    </div>
  </article></li>;
});

function TickValue({ value, updated }: { value: string; updated: boolean }) { return <span key={value} className={updated ? styles.numberUpdate : undefined}>{value}</span>; }
function TickDirection({ direction }: { direction: number }) { return <span className={`${styles.direction} ${tone(direction)}`} aria-label={direction > 0 ? "Rose on last demo update" : direction < 0 ? "Fell on last demo update" : "No price change"}>{direction > 0 ? "↗" : direction < 0 ? "↘" : "·"}</span>; }
function Sparkline({ card, compact = false }: { card: PreviewCard; compact?: boolean }) {
  const low = Math.min(...card.history) * 0.998;
  const range = Math.max(...card.history) * 1.002 - low;
  const points = card.history.map((value, index) => `${(index / (card.history.length - 1) * 280 + 4).toFixed(2)},${(64 - (value - low) / range * 56).toFixed(2)}`).join(" ");
  return <svg viewBox="0 0 288 72" preserveAspectRatio="none" className={`${compact ? styles.smallChart : styles.chart} ${tone(card.change7d)}`} role="img" aria-label={`${card.name}: illustrative seven-day price path, ${formatMovePercent(card.change7d)}, ending at ${formatMarketValue(card.marketPrice)}`}><path d="M4 67H284" stroke="currentColor" opacity="0.15" /><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.7" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}
function Meter({ value, label }: { value: number; label: string }) { return <div className={styles.meter} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span style={{ width: `${value}%` }} /></div>; }
function Metric({ label, value, className = "" }: { label: string; value: string; className?: string }) { return <div className={styles.metric}><span>{label}</span><strong className={className}>{value}</strong></div>; }
function Action({ card }: { card: PreviewCard }) { return <span className={styles.action} data-action={card.suggestedAction}>{card.suggestedAction} <span>{card.actionCopies}</span></span>; }
function tone(value: number) { return value > 0 ? styles.positive : value < 0 ? styles.negative : styles.neutral; }
