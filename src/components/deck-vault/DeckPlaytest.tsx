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
  Hand,
  Layers3,
  Play,
  RotateCcw,
  Shuffle,
  SkipForward,
  Swords,
  Undo2,
} from "lucide-react";

import type { DeckCard } from "@/lib/deck-vault/types";

type TestCard = DeckCard & { instanceId: string };
type Zone = "hand" | "battlefield" | "graveyard" | "exile" | "library";

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

function CardFace({ card, compact = false }: { card: TestCard | DeckCard; compact?: boolean }) {
  return (
    <div className={compact ? "w-24 sm:w-28" : "w-32 sm:w-36 lg:w-40"}>
      <div className="relative aspect-[5/7] overflow-hidden rounded-xl border border-white/[0.12] bg-[#0b1b28] shadow-[0_16px_40px_rgba(0,0,0,.35)]">
        {card.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.image} alt={card.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-xs font-semibold text-slate-300">
            {card.name}
          </div>
        )}
      </div>
      <p className="mt-2 truncate text-center text-[11px] font-medium text-slate-300">{card.name}</p>
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

  const newHand = useCallback((play = onThePlay) => {
    const shuffled = shuffleCards(expanded);
    setLibrary(shuffled.slice(7));
    setHand(shuffled.slice(0, 7));
    setBattlefield([]);
    setGraveyard([]);
    setExile([]);
    setTurn(1);
    setMulligans(0);
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
    setters[to]((zone) => (to === "library" ? [...zone, card] : [...zone, card]));
  }

  function nextTurn() {
    setTurn((value) => value + 1);
    draw(1);
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
    <div className="mt-6 space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-cyan-300/[0.12] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.1),transparent_38%),#06131f] p-5 sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-300">
              <Swords className="h-4 w-4" /> Live deck simulator
            </div>
            <h2 className="mt-2 text-2xl font-semibold">Playtest your opening line</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Shuffle, mulligan, draw through turns, and move cards between the zones just like a tabletop test game.
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

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Stat label="Turn" value={turn} />
          <Stat label="Library" value={library.length} />
          <Stat label="Hand" value={hand.length} />
          <Stat label="Battlefield" value={battlefield.length} />
          <Stat label="Graveyard" value={graveyard.length} />
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

      <ZonePanel title="Opening hand / hand" count={hand.length} empty="Your hand is empty.">
        {hand.map((card) => (
          <InteractiveCard key={card.instanceId} card={card} primaryLabel="Play" onPrimary={() => moveCard(card, "hand", "battlefield")} secondaryLabel="Discard" onSecondary={() => moveCard(card, "hand", "graveyard")} />
        ))}
      </ZonePanel>

      <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
        <ZonePanel title="Battlefield" count={battlefield.length} empty="Play a card from your hand to begin.">
          {battlefield.map((card) => (
            <InteractiveCard key={card.instanceId} card={card} compact primaryLabel="Return" onPrimary={() => moveCard(card, "battlefield", "hand")} secondaryLabel="Graveyard" onSecondary={() => moveCard(card, "battlefield", "graveyard")} />
          ))}
        </ZonePanel>
        <section className="rounded-[24px] border border-white/[0.07] bg-[#06131f] p-5">
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

function ZonePanel({ title, count, empty, children }: { title: string; count: number; empty: string; children: ReactNode }) {
  return (
    <section className="min-h-[250px] rounded-[24px] border border-white/[0.07] bg-[#06131f] p-5">
      <div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-cyan-300" /><h3 className="font-semibold">{title}</h3><span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-slate-400">{count}</span></div>
      {count ? <div className="mt-5 flex flex-wrap gap-4">{children}</div> : <div className="mt-5 grid min-h-[170px] place-items-center rounded-2xl border border-dashed border-white/[0.07] text-sm text-slate-600">{empty}</div>}
    </section>
  );
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
