"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive, ChevronRight, CircleDot, Crown, Hand, Layers3, Play, RotateCcw,
  Search, Shuffle, Sparkles, Undo2, X, Zap,
} from "lucide-react";

import type { DeckCard } from "@/lib/deck-vault/types";

type TestCard = DeckCard & { instanceId: string; tapped?: boolean; enteredTurn?: number };
type Zone = "hand" | "battlefield" | "graveyard" | "exile" | "library";
type Phase = "Untap" | "Upkeep" | "Draw" | "Main" | "Combat" | "Second Main" | "End";
const phases: Phase[] = ["Untap", "Upkeep", "Draw", "Main", "Combat", "Second Main", "End"];

const isLand = (card: DeckCard) => card.typeLine.toLowerCase().includes("land");
const isCreature = (card: DeckCard) => card.typeLine.toLowerCase().includes("creature");
const isInstantOrSorcery = (card: DeckCard) => /instant|sorcery/i.test(card.typeLine);

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
    .flatMap((card) => Array.from({ length: Math.max(0, card.quantity) }, (_, copy) => ({
      ...card, quantity: 1, instanceId: `${card.id}-${copy}`,
    })));
}

function CardFace({ card, size = "board", tapped = false, selected = false }: { card: TestCard | DeckCard; size?: "hand" | "board" | "rail"; tapped?: boolean; selected?: boolean }) {
  const width = size === "hand" ? "w-[122px] sm:w-[142px] xl:w-[154px]" : size === "rail" ? "w-[74px]" : "w-[98px] sm:w-[112px] xl:w-[124px]";
  return <div className={`${width} shrink-0 transition-all duration-300 ease-out ${tapped ? "mx-4 rotate-90 sm:mx-5" : ""} ${selected ? "-translate-y-3" : ""}`}>
    <div className={`relative aspect-[5/7] overflow-hidden rounded-[11px] border bg-[#07131c] transition-all duration-300 ${selected ? "border-cyan-300 shadow-[0_0_0_3px_rgba(34,211,238,.14),0_28px_65px_rgba(0,0,0,.62)]" : tapped ? "border-cyan-300/45 shadow-[0_0_30px_rgba(34,211,238,.18)]" : "border-white/[0.16] shadow-[0_18px_45px_rgba(0,0,0,.5)]"}`}>
      {card.image ? <img src={card.image} alt={card.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center p-3 text-center text-xs font-semibold text-slate-300">{card.name}</div>}
      {selected ? <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-cyan-300/10 to-transparent" /> : null}
    </div>
  </div>;
}

export function DeckPlaytest({ cards, commanderName }: { cards: DeckCard[]; commanderName?: string }) {
  const expanded = useMemo(() => expandDeck(cards, commanderName), [cards, commanderName]);
  const commander = useMemo(() => cards.find((card) => card.board === "commander" || card.name === commanderName), [cards, commanderName]);
  const [library, setLibrary] = useState<TestCard[]>([]);
  const [hand, setHand] = useState<TestCard[]>([]);
  const [battlefield, setBattlefield] = useState<TestCard[]>([]);
  const [graveyard, setGraveyard] = useState<TestCard[]>([]);
  const [exile, setExile] = useState<TestCard[]>([]);
  const [turn, setTurn] = useState(1);
  const [phase, setPhase] = useState<Phase>("Main");
  const [onThePlay, setOnThePlay] = useState(true);
  const [mulligans, setMulligans] = useState(0);
  const [started, setStarted] = useState(false);
  const [manaPool, setManaPool] = useState(0);
  const [landPlayedTurn, setLandPlayedTurn] = useState<number | null>(null);
  const [selected, setSelected] = useState<TestCard | null>(null);
  const [openZone, setOpenZone] = useState<"graveyard" | "exile" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const newHand = useCallback((play = onThePlay) => {
    const shuffled = shuffleCards(expanded);
    setLibrary(shuffled.slice(7)); setHand(shuffled.slice(0, 7)); setBattlefield([]); setGraveyard([]); setExile([]);
    setTurn(1); setPhase("Main"); setMulligans(0); setManaPool(0); setLandPlayedTurn(null); setSelected(null); setOnThePlay(play); setStarted(true);
  }, [expanded, onThePlay]);

  useEffect(() => { if (!started && expanded.length) newHand(true); }, [expanded, newHand, started]);

  const draw = useCallback((amount = 1) => {
    setLibrary((current) => {
      const count = Math.min(amount, current.length);
      setHand((currentHand) => [...currentHand, ...current.slice(0, count)]);
      return current.slice(count);
    });
  }, []);

  function moveCard(card: TestCard, from: Zone, to: Zone) {
    const setters = { hand: setHand, battlefield: setBattlefield, graveyard: setGraveyard, exile: setExile, library: setLibrary };
    setters[from]((zone) => zone.filter((entry) => entry.instanceId !== card.instanceId));
    setters[to]((zone) => [...zone, { ...card, tapped: false }]);
    setSelected(null);
  }

  function londonMulligan() {
    const shuffled = shuffleCards([...library, ...hand, ...battlefield, ...graveyard, ...exile]);
    setHand(shuffled.slice(0, 7)); setLibrary(shuffled.slice(7)); setBattlefield([]); setGraveyard([]); setExile([]);
    setMulligans((value) => value + 1); setTurn(1); setPhase("Main"); setManaPool(0); setLandPlayedTurn(null); setSelected(null);
  }

  function nextTurn() {
    setTurn((value) => value + 1); setPhase("Untap"); setBattlefield((current) => current.map((card) => ({ ...card, tapped: false })));
    setManaPool(0); setLandPlayedTurn(null); draw(1); showToast("Untapped permanents and drew for turn.");
  }

  function nextPhase() {
    const index = phases.indexOf(phase);
    if (index === phases.length - 1) { nextTurn(); return; }
    const next = phases[index + 1]; setPhase(next);
    if (next === "Untap") setBattlefield((current) => current.map((card) => ({ ...card, tapped: false })));
    if (next === "Draw") draw(1);
  }

  function tapPermanent(card: TestCard) {
    const tapping = !card.tapped;
    setBattlefield((current) => current.map((entry) => entry.instanceId === card.instanceId ? { ...entry, tapped: tapping } : entry));
    setSelected({ ...card, tapped: tapping });
    if (isLand(card)) { setManaPool((value) => Math.max(0, value + (tapping ? 1 : -1))); showToast(tapping ? `${card.name} added 1 mana.` : `${card.name} untapped.`); }
  }

  function playFromHand(card: TestCard, autoPay = false) {
    if (isLand(card)) {
      if (landPlayedTurn === turn) { showToast("You have already played a land this turn."); return; }
      setLandPlayedTurn(turn); moveCard({ ...card, enteredTurn: turn }, "hand", "battlefield"); showToast(`${card.name} entered the battlefield.`); return;
    }
    const cost = Math.max(0, Math.ceil(card.manaValue));
    const available = battlefield.filter((entry) => isLand(entry) && !entry.tapped);
    const needed = Math.max(0, cost - manaPool);
    if ((!autoPay && manaPool < cost) || (autoPay && available.length < needed)) { showToast(`Tap ${autoPay ? needed - available.length : cost - manaPool} more land${cost - manaPool === 1 ? "" : "s"} to cast ${card.name}.`); return; }
    if (autoPay) {
      const chosen = new Set(available.slice(0, needed).map((entry) => entry.instanceId));
      setBattlefield((current) => current.map((entry) => chosen.has(entry.instanceId) ? { ...entry, tapped: true } : entry));
      setManaPool((value) => value + needed - cost);
    } else setManaPool((value) => value - cost);
    moveCard({ ...card, enteredTurn: turn }, "hand", isInstantOrSorcery(card) ? "graveyard" : "battlefield");
    showToast(`Paid ${cost} mana and cast ${card.name}.`);
  }

  if (!expanded.length) return <section className="mt-6 rounded-[28px] border border-white/[0.08] bg-[#06131f] p-10 text-center"><h2 className="text-xl font-semibold">Add cards before playtesting</h2><p className="mt-2 text-sm text-slate-500">The simulator needs a main deck to shuffle and draw.</p></section>;

  const selectedInHand = selected && hand.some((card) => card.instanceId === selected.instanceId);
  const selectedOnBoard = selected && battlefield.some((card) => card.instanceId === selected.instanceId);
  const untappedLands = battlefield.filter((card) => isLand(card) && !card.tapped).length;
  const graveTop = graveyard.at(-1);
  const exileTop = exile.at(-1);

  return <div className="relative mt-4 overflow-hidden rounded-[30px] border border-cyan-300/[0.15] bg-[#030b11] shadow-[0_35px_100px_rgba(0,0,0,.45)]">
    {toast ? <div className="fixed bottom-7 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-cyan-300/25 bg-[#071722]/95 px-5 py-3 text-sm font-semibold text-cyan-50 shadow-2xl backdrop-blur-xl">{toast}</div> : null}

    <header className="flex flex-col gap-4 border-b border-white/[0.07] bg-[#06131c]/95 px-5 py-4 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-300"><Sparkles className="h-5 w-5" /></div><div><div className="flex items-center gap-2"><h2 className="font-semibold tracking-tight">Playtest Studio</h2><span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200">Sandbox</span></div><p className="text-[11px] text-slate-500">Turn {turn} · {onThePlay ? "On the play" : "On the draw"}</p></div></div>
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-black/20 p-1">{phases.map((item) => <button key={item} type="button" onClick={() => setPhase(item)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-semibold transition ${phase === item ? "bg-cyan-300 text-[#00131c] shadow-[0_0_20px_rgba(34,211,238,.18)]" : "text-slate-500 hover:text-slate-200"}`}>{item}</button>)}</div>
      <div className="flex items-center gap-2"><button type="button" onClick={() => newHand(onThePlay)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-slate-400 hover:bg-white/[0.05]" title="New hand"><Shuffle className="h-4 w-4" /></button><button type="button" onClick={londonMulligan} className="inline-flex h-9 items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3 text-[11px] font-semibold text-amber-100"><RotateCcw className="h-3.5 w-3.5" /> Mulligan {mulligans ? `(${mulligans})` : ""}</button><button type="button" onClick={nextPhase} className="inline-flex h-9 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-[11px] font-bold text-[#00131c]">Next phase <ChevronRight className="h-3.5 w-3.5" /></button></div>
    </header>

    <div className="grid min-h-[720px] lg:grid-cols-[1fr_168px]">
      <main className="relative flex min-w-0 flex-col bg-[radial-gradient(circle_at_48%_44%,rgba(13,148,136,.14),transparent_38%),linear-gradient(rgba(255,255,255,.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.015)_1px,transparent_1px),linear-gradient(145deg,#071a1e,#041218_58%,#06131c)] bg-[size:auto,38px_38px,38px_38px,auto]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,.35)_100%)]" />
        <div className="relative flex flex-1 flex-col px-5 pb-4 pt-5 sm:px-8">
          <div className="mb-3 flex items-center justify-between"><ZoneLabel label="Creatures & permanents" count={battlefield.filter((card) => !isLand(card)).length} /><span className="hidden text-[10px] text-slate-600 sm:block">Select a card for actions · Click a land to tap</span></div>
          <BoardRow cards={battlefield.filter((card) => !isLand(card))} selected={selected} turn={turn} onSelect={setSelected} empty="Cast a permanent to begin building your board" />
          <div className="my-5 h-px bg-gradient-to-r from-transparent via-cyan-200/[0.1] to-transparent" />
          <div className="mb-3 flex items-center justify-between"><ZoneLabel label="Mana base" count={battlefield.filter(isLand).length} /><div className="flex items-center gap-2 rounded-full border border-cyan-300/15 bg-[#04151c]/80 px-3 py-1.5 text-[11px] font-semibold text-cyan-100"><Zap className="h-3.5 w-3.5 text-cyan-300" /> Mana pool <span className="text-base text-white">{manaPool}</span></div></div>
          <BoardRow cards={battlefield.filter(isLand)} selected={selected} turn={turn} onSelect={tapPermanent} empty="Play a land from your hand" />
        </div>

        <section className="relative border-t border-white/[0.07] bg-[#030c12]/78 px-4 pb-5 pt-4 backdrop-blur-md sm:px-7">
          <div className="mb-3 flex items-center justify-between"><ZoneLabel label="Hand" count={hand.length} /><div className="flex items-center gap-2"><button type="button" onClick={() => draw(1)} disabled={!library.length} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 hover:text-white disabled:opacity-30"><Hand className="h-3 w-3" /> Draw</button><span className="text-[10px] text-slate-600">Select a card to play it</span></div></div>
          <div className="flex min-h-[220px] items-end gap-2 overflow-x-auto px-2 pb-3 pt-5 sm:gap-3">{hand.map((card) => <button key={card.instanceId} type="button" onClick={() => setSelected(selected?.instanceId === card.instanceId ? null : card)} className="group shrink-0 rounded-xl focus:outline-none"><CardFace card={card} size="hand" selected={selected?.instanceId === card.instanceId} /><p className="mt-2 max-w-[142px] truncate text-center text-[10px] font-medium text-slate-500 group-hover:text-slate-200">{card.name}</p></button>)}</div>
        </section>
      </main>

      <aside className="relative z-10 grid grid-cols-3 border-t border-white/[0.07] bg-[#05111a] p-3 lg:flex lg:flex-col lg:border-l lg:border-t-0">
        <SideZone icon={<Crown className="h-3.5 w-3.5" />} label="Command" count={commander ? 1 : 0}>{commander ? <CardFace card={commander} size="rail" /> : null}</SideZone>
        <SideZone icon={<Layers3 className="h-3.5 w-3.5" />} label="Library" count={library.length}><div className="grid aspect-[5/7] w-[74px] place-items-center rounded-[9px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.16),transparent_55%),#071722] shadow-xl"><span className="text-2xl font-semibold text-cyan-100">{library.length}</span></div></SideZone>
        <button type="button" onClick={() => setOpenZone("graveyard")} className="text-left"><SideZone icon={<CircleDot className="h-3.5 w-3.5" />} label="Graveyard" count={graveyard.length}>{graveTop ? <CardFace card={graveTop} size="rail" /> : <EmptyMini />}</SideZone></button>
        <button type="button" onClick={() => setOpenZone("exile")} className="text-left"><SideZone icon={<Archive className="h-3.5 w-3.5" />} label="Exile" count={exile.length}>{exileTop ? <CardFace card={exileTop} size="rail" /> : <EmptyMini />}</SideZone></button>
        <div className="col-span-2 mt-auto hidden space-y-2 border-t border-white/[0.06] pt-4 lg:block"><MiniStat label="Battlefield" value={battlefield.length} /><MiniStat label="Hand" value={hand.length} /><button type="button" onClick={() => setOnThePlay((value) => !value)} className="w-full rounded-lg border border-white/[0.06] px-2 py-2 text-[10px] font-semibold text-cyan-200">{onThePlay ? "On the play" : "On the draw"}</button></div>
      </aside>
    </div>

    {selected ? <div className="absolute bottom-[244px] left-1/2 z-40 flex w-[calc(100%-32px)] max-w-2xl -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-cyan-300/20 bg-[#061722]/95 p-3 shadow-[0_24px_70px_rgba(0,0,0,.65)] backdrop-blur-xl lg:left-[calc(50%-84px)]">
      <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{selected.name}</p><p className="truncate text-[10px] text-slate-500">{selected.typeLine} {selectedInHand && !isLand(selected) ? `· ${Math.ceil(selected.manaValue)} mana` : ""}</p></div>
      <div className="flex shrink-0 items-center gap-2">{selectedInHand ? <><button type="button" onClick={() => playFromHand(selected, false)} disabled={!isLand(selected) && manaPool < Math.ceil(selected.manaValue)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] px-3 text-[11px] font-semibold text-cyan-100 disabled:opacity-30"><Play className="h-3.5 w-3.5" /> {isLand(selected) ? "Play land" : "Cast"}</button>{!isLand(selected) ? <button type="button" onClick={() => playFromHand(selected, true)} disabled={manaPool + untappedLands < Math.ceil(selected.manaValue)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-cyan-300 px-3 text-[11px] font-bold text-[#00131c] disabled:opacity-30"><Sparkles className="h-3.5 w-3.5" /> Auto-pay</button> : null}<button type="button" onClick={() => moveCard(selected, "hand", "graveyard")} className="h-9 rounded-xl border border-white/[0.08] px-3 text-[11px] font-semibold text-slate-400">Discard</button></> : null}{selectedOnBoard ? <><button type="button" onClick={() => tapPermanent(selected)} className="h-9 rounded-xl bg-cyan-300 px-3 text-[11px] font-bold text-[#00131c]">{selected.tapped ? "Untap" : "Tap"}</button><button type="button" onClick={() => moveCard(selected, "battlefield", "hand")} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-slate-400" title="Return to hand"><Undo2 className="h-4 w-4" /></button><button type="button" onClick={() => moveCard(selected, "battlefield", "graveyard")} className="h-9 rounded-xl border border-white/[0.08] px-3 text-[11px] font-semibold text-slate-400">Graveyard</button></> : null}<button type="button" onClick={() => setSelected(null)} className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-white/[0.05]"><X className="h-4 w-4" /></button></div>
    </div> : null}

    {openZone ? <ZoneDrawer title={openZone === "graveyard" ? "Graveyard" : "Exile"} cards={openZone === "graveyard" ? graveyard : exile} onClose={() => setOpenZone(null)} onReturn={(card) => moveCard(card, openZone, "hand")} onSwitch={(card) => moveCard(card, openZone, openZone === "graveyard" ? "exile" : "graveyard")} /> : null}
  </div>;
}

function ZoneLabel({ label, count }: { label: string; count: number }) { return <div className="flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span><span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] text-slate-500">{count}</span></div>; }

function BoardRow({ cards, selected, turn, onSelect, empty }: { cards: TestCard[]; selected: TestCard | null; turn: number; onSelect: (card: TestCard) => void; empty: string }) {
  return <div className="flex min-h-[180px] flex-wrap content-start items-start gap-4 rounded-[22px] border border-white/[0.035] bg-black/[0.08] p-4 sm:gap-5">{cards.length ? cards.map((card) => <button key={card.instanceId} type="button" onClick={() => onSelect(card)} className="group relative rounded-xl focus:outline-none"><CardFace card={card} tapped={card.tapped} selected={selected?.instanceId === card.instanceId} />{!card.tapped && isCreature(card) && card.enteredTurn === turn ? <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-300/20 bg-[#21190a]/95 px-2 py-1 text-[8px] font-bold uppercase tracking-wide text-amber-200">Summoning sick</span> : null}</button>) : <div className="grid w-full flex-1 place-items-center"><div className="text-center"><CircleDot className="mx-auto h-5 w-5 text-slate-700" /><p className="mt-2 text-[11px] text-slate-700">{empty}</p></div></div>}</div>;
}

function SideZone({ icon, label, count, children }: { icon: ReactNode; label: string; count: number; children: ReactNode }) { return <div className="flex flex-col items-center border-white/[0.06] p-2 lg:border-b lg:pb-4 lg:pt-3"><div className="mb-2 flex w-full items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-600"><span className="flex items-center gap-1">{icon}{label}</span><span>{count}</span></div>{children}</div>; }
function EmptyMini() { return <div className="grid aspect-[5/7] w-[74px] place-items-center rounded-[9px] border border-dashed border-white/[0.08] text-[9px] text-slate-700">Empty</div>; }
function MiniStat({ label, value }: { label: string; value: number }) { return <div className="flex items-center justify-between text-[10px]"><span className="text-slate-600">{label}</span><span className="font-semibold text-slate-300">{value}</span></div>; }

function ZoneDrawer({ title, cards, onClose, onReturn, onSwitch }: { title: string; cards: TestCard[]; onClose: () => void; onReturn: (card: TestCard) => void; onSwitch: (card: TestCard) => void }) {
  return <div className="absolute inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm" onClick={onClose}><section className="h-full w-full max-w-lg border-l border-cyan-300/[0.14] bg-[#06131c] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">Zone explorer</p><h3 className="mt-1 text-xl font-semibold">{title} <span className="text-slate-600">({cards.length})</span></h3></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] text-slate-400"><X className="h-4 w-4" /></button></div><div className="mt-5 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 text-slate-600"><Search className="h-4 w-4" /><span className="text-xs">Cards in this zone</span></div><div className="mt-5 grid grid-cols-2 gap-4 overflow-y-auto pb-8 sm:grid-cols-3">{cards.map((card) => <div key={card.instanceId} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2"><CardFace card={card} size="board" /><p className="mt-2 truncate text-[10px] font-semibold text-slate-300">{card.name}</p><div className="mt-2 grid gap-1"><button type="button" onClick={() => onReturn(card)} className="h-8 rounded-lg bg-cyan-300 text-[10px] font-bold text-[#00131c]">Return to hand</button><button type="button" onClick={() => onSwitch(card)} className="h-7 text-[9px] font-semibold text-slate-500">Move to {title === "Graveyard" ? "exile" : "graveyard"}</button></div></div>)}</div></section></div>;
}
