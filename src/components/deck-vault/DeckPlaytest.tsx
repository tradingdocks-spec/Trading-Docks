"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  CircleDot,
  Hand,
  LandPlot,
  Layers3,
  LockKeyhole,
  MousePointerClick,
  Play,
  RotateCcw,
  Shuffle,
  SkipForward,
  Sparkles,
  Undo,
  Undo2,
  Zap,
} from "lucide-react";

import type { DeckCard } from "@/lib/deck-vault/types";

type TestCard = DeckCard & { instanceId: string; tapped?: boolean; enteredTurn?: number };
type Zone = "hand" | "battlefield" | "graveyard" | "exile" | "library";

function isLand(card: DeckCard) {
  return card.typeLine.toLowerCase().includes("land");
}

function isCreature(card: DeckCard) {
  return card.typeLine.toLowerCase().includes("creature");
}

function isInstantOrSorcery(card: DeckCard) {
  const type = card.typeLine.toLowerCase();
  return type.includes("instant") || type.includes("sorcery");
}

function shuffleCards<T>(input: T[]) {
  const result = [...input];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function expandDeck(cards: DeckCard[], commanderName?: string) {
  return cards
    .filter((card) => card.board !== "commander" && card.name !== commanderName && card.board !== "sideboard" && card.board !== "maybeboard")
    .flatMap((card) =>
      Array.from({ length: Math.max(0, card.quantity) }, (_, copy) => ({
        ...card,
        quantity: 1,
        instanceId: `${card.id}-${copy}`,
      })),
    );
}

function CardFace({ card, compact = false, tapped = false }: { card: TestCard | DeckCard; compact?: boolean; tapped?: boolean }) {
  return (
    <div className={`${compact ? "w-[82px] sm:w-24 xl:w-[106px]" : "w-28 sm:w-32 lg:w-36"} transition-all duration-300 ${tapped ? "rotate-90 mx-4 sm:mx-5" : ""}`}>
      <div className={`relative aspect-[5/7] overflow-hidden rounded-[10px] border bg-[#0b1b28] transition-all duration-300 ${tapped ? "border-cyan-300/50 shadow-[0_0_28px_rgba(34,211,238,.16)]" : "border-white/[0.14] shadow-[0_18px_45px_rgba(0,0,0,.42)]"}`}>
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image} alt={card.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-xs font-semibold text-slate-300">
            {card.name}
          </div>
        )}
      </div>
      {!tapped ? <p className="mt-2 truncate text-center text-[11px] font-medium text-slate-300">{card.name}</p> : null}
    </div>
  );
}

export function DeckPlaytest({
  cards,
  commanderName,
}: {
  cards: DeckCard[];
  commanderName?: string;
}) {
  const expanded = useMemo(() => expandDeck(cards, commanderName), [cards, commanderName]);
  const commander = useMemo(
    () => cards.find((card) => card.board === "commander" || card.name === commanderName),
    [cards, commanderName],
  );
  const [library, setLibrary] = useState<TestCard[]>([]);
  const [hand, setHand] = useState<TestCard[]>([]);
  const [battlefield, setBattlefield] = useState<TestCard[]>([]);
  const [graveyard, setGraveyard] = useState<TestCard[]>([]);
  const [exile, setExile] = useState<TestCard[]>([]);
  const [turn, setTurn] = useState(1);
  const [onThePlay, setOnThePlay] = useState(true);
  const [mulligans, setMulligans] = useState(0);
  const [started, setStarted] = useState(false);
  const [manaPool, setManaPool] = useState(0);
  const [landPlayedTurn, setLandPlayedTurn] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const newHand = useCallback((play = onThePlay) => {
    const shuffled = shuffleCards(expanded);
    setLibrary(shuffled.slice(7));
    setHand(shuffled.slice(0, 7));
    setBattlefield([]);
    setGraveyard([]);
    setExile([]);
    setTurn(1);
    setMulligans(0);
    setManaPool(0);
    setLandPlayedTurn(null);
    setOnThePlay(play);
    setStarted(true);
  }, [expanded, onThePlay]);

  useEffect(() => {
    if (!started && expanded.length) newHand(true);
  }, [expanded, newHand, started]);

  const draw = useCallback((amount = 1) => {
    setLibrary((current) => {
      const count = Math.min(amount, current.length);
      setHand((currentHand) => [...currentHand, ...current.slice(0, count)]);
      return current.slice(count);
    });
  }, []);

  function londonMulligan() {
    const allCards = [...library, ...hand, ...battlefield, ...graveyard, ...exile];
    const shuffled = shuffleCards(allCards);
    setHand(shuffled.slice(0, 7));
    setLibrary(shuffled.slice(7));
    setBattlefield([]);
    setGraveyard([]);
    setExile([]);
    setMulligans((value) => value + 1);
    setTurn(1);
    setManaPool(0);
    setLandPlayedTurn(null);
  }

  function moveCard(card: TestCard, from: Zone, to: Zone) {
    const setters: Record<Zone, Dispatch<SetStateAction<TestCard[]>>> = {
      hand: setHand,
      battlefield: setBattlefield,
      graveyard: setGraveyard,
      exile: setExile,
      library: setLibrary,
    };
    setters[from]((zone) => zone.filter((entry) => entry.instanceId !== card.instanceId));
    setters[to]((zone) => [...zone, { ...card, tapped: false }]);
  }

  function nextTurn() {
    setTurn((value) => value + 1);
    setBattlefield((current) => current.map((card) => ({ ...card, tapped: false })));
    setManaPool(0);
    setLandPlayedTurn(null);
    draw(1);
    showToast("Untapped, upkeep complete, and drew for turn.");
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  }

  function tapPermanent(card: TestCard) {
    const tapping = !card.tapped;
    setBattlefield((current) => current.map((entry) => entry.instanceId === card.instanceId ? { ...entry, tapped: tapping } : entry));
    if (isLand(card)) {
      setManaPool((value) => Math.max(0, value + (tapping ? 1 : -1)));
      showToast(tapping ? `${card.name} added 1 mana.` : `${card.name} untapped.`);
    }
  }

  function playFromHand(card: TestCard) {
    if (isLand(card)) {
      if (landPlayedTurn === turn) {
        showToast("You have already played a land this turn.");
        return;
      }
      setLandPlayedTurn(turn);
      moveCard({ ...card, enteredTurn: turn }, "hand", "battlefield");
      showToast(`${card.name} entered the battlefield.`);
      return;
    }

    const cost = Math.max(0, Math.ceil(card.manaValue));
    if (manaPool < cost) {
      showToast(`Tap ${cost - manaPool} more land${cost - manaPool === 1 ? "" : "s"} to cast ${card.name}.`);
      return;
    }
    setManaPool((value) => value - cost);
    if (isInstantOrSorcery(card)) {
      moveCard(card, "hand", "graveyard");
      showToast(`${card.name} cast and moved to the graveyard.`);
    } else {
      moveCard({ ...card, enteredTurn: turn }, "hand", "battlefield");
      showToast(`${card.name} cast for ${cost} mana.`);
    }
  }

  function autoPayAndCast(card: TestCard) {
    const cost = Math.max(0, Math.ceil(card.manaValue));
    const needed = Math.max(0, cost - manaPool);
    const available = battlefield.filter((entry) => isLand(entry) && !entry.tapped);
    if (available.length < needed) {
      showToast(`Need ${needed - available.length} more available mana.`);
      return;
    }
    const chosen = new Set(available.slice(0, needed).map((entry) => entry.instanceId));
    setBattlefield((current) => current.map((entry) => chosen.has(entry.instanceId) ? { ...entry, tapped: true } : entry));
    setManaPool((value) => value + needed - cost);
    if (isInstantOrSorcery(card)) moveCard(card, "hand", "graveyard");
    else moveCard({ ...card, enteredTurn: turn }, "hand", "battlefield");
    showToast(`Paid ${cost} mana and cast ${card.name}.`);
  }

  if (!expanded.length) {
    return (
      <section className="mt-6 rounded-[28px] border border-white/[0.08] bg-[#06131f] p-8 text-center">
        <h2 className="text-xl font-semibold">Add cards before playtesting</h2>
        <p className="mt-2 text-sm text-slate-500">The simulator needs a main deck to shuffle and draw.</p>
      </section>
    );
  }

  return (
    <div className="relative mt-6 space-y-4">
      {toast ? <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-cyan-300/25 bg-[#071722]/95 px-5 py-3 text-sm font-semibold text-cyan-50 shadow-[0_18px_60px_rgba(0,0,0,.55)] backdrop-blur-xl">{toast}</div> : null}
      <section className="overflow-hidden rounded-[28px] border border-cyan-300/[0.14] bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,.13),transparent_32%),linear-gradient(135deg,#071925,#06111b_60%,#071722)] p-5 shadow-[0_24px_80px_rgba(0,0,0,.22)] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-300">
              <Sparkles className="h-4 w-4" /> Trading Docks playmat
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Your table. Your opening line.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Tap lands, pay mana, cast spells, and move through turns in a focused tabletop sandbox.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => newHand(onThePlay)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-xs font-semibold text-slate-200 hover:bg-white/[0.08]">
              <Shuffle className="h-4 w-4" /> New hand
            </button>
            <button type="button" onClick={londonMulligan} className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 text-xs font-semibold text-amber-100 hover:bg-amber-300/[0.1]">
              <RotateCcw className="h-4 w-4" /> Mulligan ({mulligans})
            </button>
            <button type="button" onClick={() => draw(1)} disabled={!library.length} className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-bold text-[#00121c] hover:bg-cyan-200 disabled:opacity-40">
              <Hand className="h-4 w-4" /> Draw
            </button>
            <button type="button" onClick={nextTurn} disabled={!library.length} className="inline-flex h-10 items-center gap-2 rounded-xl border border-sky-300/20 bg-sky-300/[0.06] px-4 text-xs font-semibold text-sky-100 hover:bg-sky-300/[0.1] disabled:opacity-40">
              <SkipForward className="h-4 w-4" /> Next turn
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <Stat label="Turn" value={turn} />
          <Stat label="Library" value={library.length} />
          <Stat label="Hand" value={hand.length} />
          <Stat label="Battlefield" value={battlefield.length} />
          <Stat label="Graveyard" value={graveyard.length} />
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-3 shadow-[inset_0_1px_rgba(255,255,255,.04)]"><p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-cyan-300"><Zap className="h-3 w-3" /> Mana</p><p className="mt-1 text-lg font-semibold text-cyan-100">{manaPool}</p></div>
          <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Starting</p>
            <button type="button" onClick={() => setOnThePlay((value) => !value)} className="mt-1 text-sm font-semibold text-cyan-200">
              {onThePlay ? "On the play" : "On the draw"}
            </button>
          </div>
        </div>
        {mulligans > 0 ? (
          <p className="mt-3 text-xs text-amber-200/80">London mulligan: after keeping, put {mulligans} card{mulligans === 1 ? "" : "s"} from your hand on the bottom of the library.</p>
        ) : null}
      </section>

      <ZonePanel title="Your hand" count={hand.length} empty="Your hand is empty." eyebrow="Opening hand & drawn cards">
        {hand.map((card) => (
          <HandCard key={card.instanceId} card={card} manaPool={manaPool} untappedLands={battlefield.filter((entry) => isLand(entry) && !entry.tapped).length} landPlayed={landPlayedTurn === turn} onPlay={() => playFromHand(card)} onAutoPay={() => autoPayAndCast(card)} onDiscard={() => moveCard(card, "hand", "graveyard")} />
        ))}
      </ZonePanel>

      <div className="grid gap-4 xl:grid-cols-[1fr_250px]">
        <ZonePanel title="Battlefield" count={battlefield.length} empty="Play a land or cast a permanent to begin." eyebrow="Click any permanent to tap or untap" playmat>
          <div className="w-full space-y-7">
            <BattlefieldRow label="Creatures & permanents" cards={battlefield.filter((card) => !isLand(card))} turn={turn} onTap={tapPermanent} onReturn={(card) => moveCard(card, "battlefield", "hand")} onGraveyard={(card) => moveCard(card, "battlefield", "graveyard")} />
            <BattlefieldRow label="Mana base" cards={battlefield.filter(isLand)} turn={turn} onTap={tapPermanent} onReturn={(card) => moveCard(card, "battlefield", "hand")} onGraveyard={(card) => moveCard(card, "battlefield", "graveyard")} />
          </div>
        </ZonePanel>
        <section className="rounded-[24px] border border-cyan-300/[0.1] bg-[radial-gradient(circle_at_top,rgba(34,211,238,.08),transparent_50%),#06131f] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Command zone</p>
          <div className="mt-4 flex justify-center">
            {commander ? <CardFace card={commander} compact /> : <div className="grid aspect-[5/7] w-28 place-items-center rounded-xl border border-dashed border-white/[0.1] text-center text-xs text-slate-600">No commander</div>}
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ZonePanel title="Graveyard" count={graveyard.length} empty="No cards in the graveyard.">
          {graveyard.map((card) => (
            <InteractiveCard key={card.instanceId} card={card} compact primaryLabel="Return to hand" onPrimary={() => moveCard(card, "graveyard", "hand")} secondaryLabel="Exile" onSecondary={() => moveCard(card, "graveyard", "exile")} />
          ))}
        </ZonePanel>
        <ZonePanel title="Exile" count={exile.length} empty="No cards in exile.">
          {exile.map((card) => (
            <InteractiveCard key={card.instanceId} card={card} compact primaryLabel="Return to hand" onPrimary={() => moveCard(card, "exile", "hand")} secondaryLabel="Graveyard" onSecondary={() => moveCard(card, "exile", "graveyard")} />
          ))}
        </ZonePanel>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">{label}</p><p className="mt-1 text-lg font-semibold text-white">{value}</p></div>;
}

function ZonePanel({ title, count, empty, children, eyebrow, playmat = false }: { title: string; count: number; empty: string; children: ReactNode; eyebrow?: string; playmat?: boolean }) {
  return (
    <section className={`min-h-[250px] rounded-[24px] border p-5 ${playmat ? "border-cyan-300/[0.12] bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px),radial-gradient(circle_at_50%_40%,rgba(16,185,129,.07),transparent_55%),#061822] bg-[size:28px_28px,28px_28px,auto,auto] shadow-[inset_0_1px_rgba(255,255,255,.04)]" : "border-white/[0.07] bg-[#06131f]"}`}>
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-cyan-300" /><h3 className="font-semibold">{title}</h3><span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-slate-400">{count}</span></div>{eyebrow ? <p className="mt-1 pl-6 text-[11px] text-slate-500">{eyebrow}</p> : null}</div>{playmat ? <div className="hidden items-center gap-1.5 rounded-full border border-white/[0.07] bg-black/20 px-3 py-1.5 text-[10px] font-medium text-slate-500 sm:flex"><MousePointerClick className="h-3 w-3" /> Tap cards directly</div> : null}</div>
      {count ? <div className="mt-5 flex flex-wrap gap-4">{children}</div> : <div className="mt-5 grid min-h-[170px] place-items-center rounded-2xl border border-dashed border-white/[0.07] text-sm text-slate-600">{empty}</div>}
    </section>
  );
}

function HandCard({ card, manaPool, untappedLands, landPlayed, onPlay, onAutoPay, onDiscard }: { card: TestCard; manaPool: number; untappedLands: number; landPlayed: boolean; onPlay: () => void; onAutoPay: () => void; onDiscard: () => void }) {
  const land = isLand(card);
  const cost = Math.max(0, Math.ceil(card.manaValue));
  const canCast = manaPool + untappedLands >= cost;
  const playDisabled = land ? landPlayed : manaPool < cost;
  return <div className="group relative rounded-2xl border border-transparent p-2 transition hover:border-cyan-300/15 hover:bg-cyan-300/[0.025]">
    <CardFace card={card} />
    <div className="mt-2 grid gap-1.5">
      <button type="button" onClick={onPlay} disabled={playDisabled} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.07] px-2 text-[10px] font-semibold text-cyan-100 transition hover:bg-cyan-300/[0.12] disabled:cursor-not-allowed disabled:opacity-35">{land ? <LandPlot className="h-3 w-3" /> : <Zap className="h-3 w-3" />}{land ? (landPlayed ? "Land played" : "Play land") : `Cast · ${cost}`}</button>
      {!land && manaPool < cost ? <button type="button" onClick={onAutoPay} disabled={!canCast} className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.05] px-2 text-[10px] font-semibold text-emerald-100 disabled:opacity-30"><Sparkles className="h-3 w-3" /> Auto-pay & cast</button> : null}
      <button type="button" onClick={onDiscard} className="h-7 text-[10px] font-medium text-slate-600 transition hover:text-slate-300">Discard</button>
    </div>
  </div>;
}

function BattlefieldRow({ label, cards, turn, onTap, onReturn, onGraveyard }: { label: string; cards: TestCard[]; turn: number; onTap: (card: TestCard) => void; onReturn: (card: TestCard) => void; onGraveyard: (card: TestCard) => void }) {
  return <div className="min-h-[155px] rounded-2xl border border-white/[0.05] bg-black/10 p-4">
    <div className="mb-4 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p><span className="text-[10px] text-slate-600">{cards.length} in zone</span></div>
    {cards.length ? <div className="flex flex-wrap items-start gap-4 sm:gap-5">{cards.map((card) => <div key={card.instanceId} className="group relative pb-8">
      <button type="button" onClick={() => onTap(card)} className="block rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" title={card.tapped ? "Untap permanent" : "Tap permanent"}><CardFace card={card} compact tapped={card.tapped} /></button>
      {!card.tapped && isCreature(card) && card.enteredTurn === turn ? <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-[#21190a]/95 px-2 py-1 text-[9px] font-semibold text-amber-200"><LockKeyhole className="h-2.5 w-2.5" /> Summoning sick</span> : null}
      <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"><button type="button" onClick={() => onReturn(card)} className="grid h-7 w-7 place-items-center rounded-lg border border-white/[0.08] bg-[#071722] text-slate-400" title="Return to hand"><Undo className="h-3 w-3" /></button><button type="button" onClick={() => onGraveyard(card)} className="grid h-7 w-7 place-items-center rounded-lg border border-white/[0.08] bg-[#071722] text-slate-400" title="Move to graveyard"><CircleDot className="h-3 w-3" /></button></div>
    </div>)}</div> : <div className="grid min-h-[95px] place-items-center text-xs text-slate-700">No {label.toLowerCase()} yet</div>}
  </div>;
}

function InteractiveCard({ card, compact, primaryLabel, secondaryLabel, onPrimary, onSecondary }: { card: TestCard; compact?: boolean; primaryLabel: string; secondaryLabel: string; onPrimary: () => void; onSecondary: () => void }) {
  return (
    <div className="group">
      <CardFace card={card} compact={compact} />
      <div className="mt-2 flex justify-center gap-1 opacity-70 transition group-hover:opacity-100">
        <button type="button" onClick={onPrimary} title={primaryLabel} className="inline-flex h-8 items-center gap-1 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.06] px-2 text-[10px] font-semibold text-cyan-100"><Play className="h-3 w-3" />{primaryLabel}</button>
        <button type="button" onClick={onSecondary} title={secondaryLabel} className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/[0.08] px-2 text-[10px] font-semibold text-slate-400"><Undo2 className="h-3 w-3" />{secondaryLabel}</button>
      </div>
    </div>
  );
}
