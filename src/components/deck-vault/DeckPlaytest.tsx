"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type SetStateAction } from "react";
import {
  Archive, ArrowRight, CircleDot, Crown, Hand, Layers3, Play, RotateCcw,
  Search, Shuffle, Sparkles, Undo2, X, Zap,
} from "lucide-react";

import type { DeckCard } from "@/lib/deck-vault/types";

type TestCard = DeckCard & { instanceId: string; tapped?: boolean; enteredTurn?: number };
type Zone = "hand" | "battlefield" | "graveyard" | "exile" | "library";
type BoardPosition = { x: number; y: number };

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

function CardFace({ card, size = "board", tapped = false, selected = false }: { card: TestCard | DeckCard; size?: "hand" | "board" | "rail" | "preview"; tapped?: boolean; selected?: boolean }) {
  const width = size === "hand"
    ? "w-[146px] sm:w-[170px] xl:w-[194px] 2xl:w-[208px]"
    : size === "preview"
      ? "w-[320px] 2xl:w-[360px]"
      : size === "rail"
        ? "w-[74px]"
        : "w-[108px] sm:w-[124px] xl:w-[138px]";
  const image = highResolutionImage(card.image);
  return <div className={`${width} shrink-0 transition-all duration-300 ease-out ${tapped ? "mx-4 rotate-90 sm:mx-5" : ""} ${selected ? "-translate-y-3" : ""}`}>
    <div className={`relative aspect-[5/7] overflow-hidden rounded-[11px] border bg-td-surface transition-all duration-300 ${selected ? "border-td-accent shadow-[0_0_0_3px_rgb(var(--td-accent-rgb)/.14),0_28px_65px_rgb(var(--td-shadow-rgb)/calc(.62*var(--td-shadow-strength)))]" : tapped ? "border-td-accent/45 shadow-[0_0_30px_rgb(var(--td-accent-rgb)/.18)]" : "border-td-ink/[0.16] shadow-[0_18px_45px_rgb(var(--td-shadow-rgb)/calc(.5*var(--td-shadow-strength)))]"}`}>
      {image ? <img src={image} alt={card.name} draggable={false} decoding="async" className="h-full w-full select-none object-cover [image-rendering:auto]" /> : <div className="grid h-full place-items-center p-3 text-center text-xs font-semibold text-td-secondary">{card.name}</div>}
      {selected ? <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-td-accent/10 to-transparent" /> : null}
    </div>
  </div>;
}

function highResolutionImage(image?: string) {
  if (!image) return image;
  if (image.includes("cards.scryfall.io")) return image.replace("/small/", "/large/").replace("/normal/", "/large/");
  if (image.includes("/api/scryfall-image/")) {
    const [path] = image.split("?");
    return `${path}?size=large`;
  }
  return image;
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
  const [onThePlay, setOnThePlay] = useState(true);
  const [mulligans, setMulligans] = useState(0);
  const [started, setStarted] = useState(false);
  const [manaPool, setManaPool] = useState(0);
  const [landPlayedTurn, setLandPlayedTurn] = useState<number | null>(null);
  const [selected, setSelected] = useState<TestCard | null>(null);
  const [openZone, setOpenZone] = useState<"graveyard" | "exile" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [boardPositions, setBoardPositions] = useState<Record<string, BoardPosition>>({});
  const [previewCard, setPreviewCard] = useState<TestCard | DeckCard | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const newHand = useCallback((play = onThePlay) => {
    const shuffled = shuffleCards(expanded);
    setLibrary(shuffled.slice(7)); setHand(shuffled.slice(0, 7)); setBattlefield([]); setGraveyard([]); setExile([]);
    setTurn(1); setMulligans(0); setManaPool(0); setLandPlayedTurn(null); setSelected(null); setBoardPositions({}); setOnThePlay(play); setStarted(true);
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
    setMulligans((value) => value + 1); setTurn(1); setManaPool(0); setLandPlayedTurn(null); setSelected(null); setBoardPositions({});
  }

  function nextTurn() {
    setTurn((value) => value + 1); setBattlefield((current) => current.map((card) => ({ ...card, tapped: false })));
    setManaPool(0); setLandPlayedTurn(null); draw(1); showToast("Untapped permanents and drew for turn.");
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

  function dropFromHand(card: TestCard, position: BoardPosition) {
    setBoardPositions((current) => ({ ...current, [card.instanceId]: position }));
    playFromHand(card, false);
  }

  if (!expanded.length) return <section className="mt-6 rounded-[28px] border border-td-ink/[0.08] bg-td-surface p-10 text-center"><h2 className="text-xl font-semibold">Add cards before playtesting</h2><p className="mt-2 text-sm text-td-muted">The simulator needs a main deck to shuffle and draw.</p></section>;

  const selectedInHand = selected && hand.some((card) => card.instanceId === selected.instanceId);
  const selectedOnBoard = selected && battlefield.some((card) => card.instanceId === selected.instanceId);
  const untappedLands = battlefield.filter((card) => isLand(card) && !card.tapped).length;
  const graveTop = graveyard.at(-1);
  const exileTop = exile.at(-1);

  return <div className="relative mt-4 overflow-hidden rounded-[30px] border border-td-accent/[0.15] bg-td-canvas shadow-[0_35px_100px_rgb(var(--td-shadow-rgb)/calc(.45*var(--td-shadow-strength)))]">
    {toast ? <div className="fixed bottom-7 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-td-accent/25 bg-td-surface/95 px-5 py-3 text-sm font-semibold text-td-accent-text shadow-2xl backdrop-blur-xl">{toast}</div> : null}

    <header className="flex flex-col gap-4 border-b border-td-ink/[0.07] bg-td-surface/95 px-5 py-4 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-td-accent/20 bg-td-accent/[0.08] text-td-accent-text"><Sparkles className="h-5 w-5" /></div><div><div className="flex items-center gap-2"><h2 className="font-semibold tracking-tight">Playtest Studio</h2><span className="rounded-full border border-td-success/15 bg-td-success/[0.06] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-td-success">Sandbox</span></div><p className="text-[11px] text-td-muted">Turn {turn} · {onThePlay ? "On the play" : "On the draw"}</p></div></div>
      <div className="hidden items-center gap-3 rounded-full border border-td-accent/[0.12] bg-td-accent/[0.04] px-4 py-2 text-[11px] text-td-secondary lg:flex"><Sparkles className="h-3.5 w-3.5 text-td-accent-text" /><span>Drag cards anywhere · Tap lands for mana</span></div>
      <div className="flex items-center gap-2"><button type="button" onClick={() => newHand(onThePlay)} className="grid h-9 w-9 place-items-center rounded-xl border border-td-ink/[0.08] text-td-secondary hover:bg-td-ink/[0.05]" title="New hand"><Shuffle className="h-4 w-4" /></button><button type="button" onClick={londonMulligan} className="inline-flex h-9 items-center gap-2 rounded-xl border border-td-warning/15 bg-td-warning/[0.05] px-3 text-[11px] font-semibold text-td-warning"><RotateCcw className="h-3.5 w-3.5" /> Mulligan {mulligans ? `(${mulligans})` : ""}</button><button type="button" onClick={nextTurn} className="inline-flex h-10 items-center gap-2 rounded-xl bg-td-accent px-5 text-[11px] font-bold text-td-on-accent shadow-[0_0_28px_rgb(var(--td-accent-rgb)/.16)] transition hover:bg-td-accent-hover">Next turn <ArrowRight className="h-3.5 w-3.5" /></button></div>
    </header>

    <div className="grid min-h-[720px] lg:grid-cols-[1fr_168px]">
      <main className="relative flex min-w-0 flex-col bg-[radial-gradient(circle_at_48%_44%,rgb(var(--td-accent-rgb)/.14),transparent_38%),linear-gradient(rgb(var(--td-ink-rgb)/.015)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--td-ink-rgb)/.015)_1px,transparent_1px),linear-gradient(145deg,var(--td-surface-default),var(--td-surface-default)_58%,var(--td-surface-default))] bg-[size:auto,38px_38px,38px_38px,auto]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgb(var(--td-shadow-rgb)/calc(.35*var(--td-shadow-strength)))_100%)]" />
        <div className="relative flex flex-1 flex-col px-4 pb-4 pt-4 sm:px-6">
          <div className="mb-3 flex items-center justify-between"><ZoneLabel label="Your playmat" count={battlefield.length} /><div className="flex items-center gap-2 rounded-full border border-td-accent/15 bg-td-surface/80 px-3 py-1.5 text-[11px] font-semibold text-td-accent-text"><Zap className="h-3.5 w-3.5 text-td-accent-text" /> Mana <span className="text-base text-td-primary">{manaPool}</span></div></div>
          <FreeformBoard cards={battlefield} hand={hand} selected={selected} turn={turn} positions={boardPositions} onPositionsChange={setBoardPositions} onDropFromHand={dropFromHand} onSelect={setSelected} onTapLand={tapPermanent} />
        </div>

        <section className="relative border-t border-td-ink/[0.07] bg-td-canvas/78 px-4 pb-5 pt-4 backdrop-blur-md sm:px-7">
          <div className="mb-3 flex items-center justify-between"><ZoneLabel label="Hand" count={hand.length} /><div className="flex items-center gap-2"><button type="button" onClick={() => draw(1)} disabled={!library.length} className="inline-flex items-center gap-1.5 rounded-lg border border-td-ink/[0.1] bg-td-ink/[0.025] px-2.5 py-1.5 text-[11px] font-semibold text-td-secondary transition hover:border-td-accent/20 hover:text-td-primary disabled:opacity-30"><Hand className="h-3 w-3" /> Draw</button><span className="hidden text-[11px] font-medium text-td-secondary sm:inline">Tap to select · Drag to play</span></div></div>
          <div className="grid min-h-[250px] grid-flow-col auto-cols-max items-end justify-start gap-3 overflow-x-auto px-2 pb-3 pt-5 lg:grid-flow-row lg:grid-cols-[repeat(auto-fit,minmax(194px,1fr))] lg:items-start lg:overflow-visible xl:gap-4">{hand.map((card) => <button key={card.instanceId} type="button" draggable title={card.name} aria-label={`Select ${card.name}`} onMouseEnter={() => setPreviewCard(card)} onMouseLeave={() => setPreviewCard(null)} onFocus={() => setPreviewCard(card)} onBlur={() => setPreviewCard(null)} onDragStart={(event) => { setPreviewCard(null); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-trading-docks-card", card.instanceId); }} onClick={() => setSelected(selected?.instanceId === card.instanceId ? null : card)} className="group mx-auto shrink-0 cursor-grab rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-td-accent/70 focus-visible:ring-offset-4 focus-visible:ring-offset-td-canvas active:cursor-grabbing"><CardFace card={card} size="hand" selected={selected?.instanceId === card.instanceId} /><p className="mx-auto mt-2 w-[146px] truncate rounded-lg border border-td-ink/[0.08] bg-td-surface/90 px-2.5 py-1.5 text-center text-[11px] font-semibold leading-none text-td-primary shadow-[0_8px_22px_rgb(var(--td-shadow-rgb)/calc(.32*var(--td-shadow-strength)))] transition group-hover:border-td-accent/25 group-hover:bg-td-surface group-hover:text-td-primary sm:w-[170px] xl:w-[194px] 2xl:w-[208px]">{card.name}</p></button>)}</div>
        </section>
      </main>

      <aside className="relative z-10 grid grid-cols-3 border-t border-td-ink/[0.07] bg-td-surface p-3 lg:flex lg:flex-col lg:border-l lg:border-t-0">
        <SideZone icon={<Crown className="h-3.5 w-3.5" />} label="Command" count={commander ? 1 : 0}>{commander ? <CardFace card={commander} size="rail" /> : null}</SideZone>
        <SideZone icon={<Layers3 className="h-3.5 w-3.5" />} label="Library" count={library.length}><div className="grid aspect-[5/7] w-[74px] place-items-center rounded-[9px] border border-td-accent/20 bg-[radial-gradient(circle_at_top,rgb(var(--td-accent-rgb)/.16),transparent_55%),var(--td-surface-default)] shadow-xl"><span className="text-2xl font-semibold text-td-accent-text">{library.length}</span></div></SideZone>
        <button type="button" onClick={() => setOpenZone("graveyard")} className="text-left"><SideZone icon={<CircleDot className="h-3.5 w-3.5" />} label="Graveyard" count={graveyard.length}>{graveTop ? <CardFace card={graveTop} size="rail" /> : <EmptyMini />}</SideZone></button>
        <button type="button" onClick={() => setOpenZone("exile")} className="text-left"><SideZone icon={<Archive className="h-3.5 w-3.5" />} label="Exile" count={exile.length}>{exileTop ? <CardFace card={exileTop} size="rail" /> : <EmptyMini />}</SideZone></button>
        <div className="col-span-2 mt-auto hidden space-y-2 border-t border-td-ink/[0.06] pt-4 lg:block"><MiniStat label="Battlefield" value={battlefield.length} /><MiniStat label="Hand" value={hand.length} /><button type="button" onClick={() => setOnThePlay((value) => !value)} className="w-full rounded-lg border border-td-ink/[0.06] px-2 py-2 text-[11px] font-semibold text-td-accent-text">{onThePlay ? "On the play" : "On the draw"}</button></div>
      </aside>
    </div>

    {selected ? <div className="absolute bottom-[244px] left-1/2 z-40 flex w-[calc(100%-32px)] max-w-2xl -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-td-accent/20 bg-td-surface/95 p-3 shadow-[0_24px_70px_rgb(var(--td-shadow-rgb)/calc(.65*var(--td-shadow-strength)))] backdrop-blur-xl lg:left-[calc(50%-84px)]">
      <div className="min-w-0"><p className="truncate text-sm font-semibold text-td-primary">{selected.name}</p><p className="truncate text-[11px] text-td-muted">{selected.typeLine} {selectedInHand && !isLand(selected) ? `· ${Math.ceil(selected.manaValue)} mana` : ""}</p></div>
      <div className="flex shrink-0 items-center gap-2">{selectedInHand ? <><button type="button" onClick={() => playFromHand(selected, false)} disabled={!isLand(selected) && manaPool < Math.ceil(selected.manaValue)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-td-accent/20 bg-td-accent/[0.08] px-3 text-[11px] font-semibold text-td-accent-text disabled:opacity-30"><Play className="h-3.5 w-3.5" /> {isLand(selected) ? "Play land" : "Cast"}</button>{!isLand(selected) ? <button type="button" onClick={() => playFromHand(selected, true)} disabled={manaPool + untappedLands < Math.ceil(selected.manaValue)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-td-accent px-3 text-[11px] font-bold text-td-on-accent disabled:opacity-30"><Sparkles className="h-3.5 w-3.5" /> Auto-pay</button> : null}<button type="button" onClick={() => moveCard(selected, "hand", "graveyard")} className="h-9 rounded-xl border border-td-ink/[0.08] px-3 text-[11px] font-semibold text-td-secondary">Discard</button></> : null}{selectedOnBoard ? <><button type="button" onClick={() => tapPermanent(selected)} className="h-9 rounded-xl bg-td-accent px-3 text-[11px] font-bold text-td-on-accent">{selected.tapped ? "Untap" : "Tap"}</button><button type="button" onClick={() => moveCard(selected, "battlefield", "hand")} className="grid h-9 w-9 place-items-center rounded-xl border border-td-ink/[0.08] text-td-secondary" title="Return to hand"><Undo2 className="h-4 w-4" /></button><button type="button" onClick={() => moveCard(selected, "battlefield", "graveyard")} className="h-9 rounded-xl border border-td-ink/[0.08] px-3 text-[11px] font-semibold text-td-secondary">Graveyard</button></> : null}<button type="button" onClick={() => setSelected(null)} className="grid h-9 w-9 place-items-center rounded-xl text-td-muted hover:bg-td-ink/[0.05]"><X className="h-4 w-4" /></button></div>
    </div> : null}

    {openZone ? <ZoneDrawer title={openZone === "graveyard" ? "Graveyard" : "Exile"} cards={openZone === "graveyard" ? graveyard : exile} onClose={() => setOpenZone(null)} onReturn={(card) => moveCard(card, openZone, "hand")} onSwitch={(card) => moveCard(card, openZone, openZone === "graveyard" ? "exile" : "graveyard")} /> : null}
    {previewCard ? <div className="pointer-events-none fixed right-7 top-1/2 z-[80] hidden -translate-y-1/2 xl:block"><div className="rounded-[24px] border border-td-accent/25 bg-td-surface/95 p-3 shadow-[0_35px_100px_rgb(var(--td-shadow-rgb)/calc(.75*var(--td-shadow-strength))),0_0_55px_rgb(var(--td-accent-rgb)/.12)] backdrop-blur-xl"><CardFace card={previewCard} size="preview" /><div className="mt-3 flex items-center justify-between gap-4 px-1"><p className="max-w-[260px] truncate text-sm font-semibold text-td-primary">{previewCard.name}</p><span className="rounded-full border border-td-accent/20 bg-td-accent/[0.08] px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-td-accent-text">HD preview</span></div></div></div> : null}
  </div>;
}

function ZoneLabel({ label, count }: { label: string; count: number }) { return <div className="flex items-center gap-2"><span className="text-[11px] font-bold uppercase tracking-[0.16em] text-td-secondary">{label}</span><span className="rounded-full border border-td-ink/[0.07] bg-td-ink/[0.06] px-2 py-0.5 text-[11px] font-semibold text-td-secondary">{count}</span></div>; }

function FreeformBoard({ cards, hand, selected, turn, positions, onPositionsChange, onDropFromHand, onSelect, onTapLand }: { cards: TestCard[]; hand: TestCard[]; selected: TestCard | null; turn: number; positions: Record<string, BoardPosition>; onPositionsChange: Dispatch<SetStateAction<Record<string, BoardPosition>>>; onDropFromHand: (card: TestCard, position: BoardPosition) => void; onSelect: (card: TestCard) => void; onTapLand: (card: TestCard) => void }) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; origin: BoardPosition; moved: boolean } | null>(null);

  useEffect(() => {
    const next = { ...positions }; let changed = false;
    cards.forEach((card, index) => { if (!next[card.instanceId]) { const land = isLand(card); next[card.instanceId] = { x: 4 + (index % 7) * 13, y: land ? 66 : 16 + (Math.floor(index / 7) % 2) * 24 }; changed = true; } });
    if (changed) onPositionsChange(next);
  }, [cards, onPositionsChange, positions]);

  function pointerDown(event: ReactPointerEvent<HTMLButtonElement>, card: TestCard) {
    const origin = positions[card.instanceId] ?? { x: 5, y: isLand(card) ? 66 : 16 };
    dragRef.current = { id: card.instanceId, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }
  function pointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current; const board = boardRef.current; if (!drag || drag.pointerId !== event.pointerId || !board) return;
    const rect = board.getBoundingClientRect(); const dx = event.clientX - drag.startX; const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
    onPositionsChange((current) => ({ ...current, [drag.id]: { x: Math.max(0, Math.min(88, drag.origin.x + dx / rect.width * 100)), y: Math.max(0, Math.min(70, drag.origin.y + dy / rect.height * 100)) } }));
  }
  function pointerUp(event: ReactPointerEvent<HTMLButtonElement>, card: TestCard) {
    const moved = dragRef.current?.moved; dragRef.current = null;
    if (!moved) { if (isLand(card)) onTapLand(card); else onSelect(card); }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function dropCard(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    const id = event.dataTransfer.getData("application/x-trading-docks-card");
    const card = hand.find((entry) => entry.instanceId === id);
    const board = boardRef.current;
    if (!card || !board) return;
    const rect = board.getBoundingClientRect();
    onDropFromHand(card, { x: Math.max(0, Math.min(88, ((event.clientX - rect.left - 58) / rect.width) * 100)), y: Math.max(0, Math.min(70, ((event.clientY - rect.top - 78) / rect.height) * 100)) });
  }

  return <div ref={boardRef} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={dropCard} className="relative min-h-[430px] flex-1 overflow-hidden rounded-[24px] border border-td-ink/[0.045] bg-[radial-gradient(circle_at_50%_40%,rgb(var(--td-accent-rgb)/.045),transparent_45%),linear-gradient(180deg,rgb(var(--td-ink-rgb)/.018),transparent)] shadow-[inset_0_1px_0_rgb(var(--td-ink-rgb)/.025)] touch-none">
    <div className="pointer-events-none absolute inset-x-5 top-[58%] border-t border-dashed border-td-accent/[0.07]" />
    <span className="pointer-events-none absolute left-5 top-4 text-[11px] font-bold uppercase tracking-[0.18em] text-td-muted">Spells & permanents</span><span className="pointer-events-none absolute bottom-4 left-5 text-[11px] font-bold uppercase tracking-[0.18em] text-td-muted">Suggested land area</span>
    {!cards.length ? <div className="absolute inset-0 grid place-items-center text-center"><div><CircleDot className="mx-auto h-5 w-5 text-td-muted" /><p className="mt-2 text-[11px] text-td-muted">Play a card from your hand to start testing</p></div></div> : null}
    {cards.map((card) => { const position = positions[card.instanceId] ?? { x: 5, y: isLand(card) ? 66 : 16 }; return <button key={card.instanceId} type="button" style={{ left: `${position.x}%`, top: `${position.y}%`, zIndex: selected?.instanceId === card.instanceId ? 20 : 2 }} onPointerDown={(event) => pointerDown(event, card)} onPointerMove={pointerMove} onPointerUp={(event) => pointerUp(event, card)} className="group absolute cursor-grab rounded-xl focus:outline-none active:cursor-grabbing"><CardFace card={card} tapped={card.tapped} selected={selected?.instanceId === card.instanceId} />{!card.tapped && isCreature(card) && card.enteredTurn === turn ? <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-td-warning/20 bg-td-surface/95 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-td-warning">Summoning sick</span> : null}</button>; })}
  </div>;
}

function SideZone({ icon, label, count, children }: { icon: ReactNode; label: string; count: number; children: ReactNode }) { return <div className="flex flex-col items-center border-td-ink/[0.06] p-2 lg:border-b lg:pb-4 lg:pt-3"><div className="mb-2 flex w-full items-center justify-between text-[11px] font-bold uppercase tracking-wider text-td-muted"><span className="flex items-center gap-1">{icon}{label}</span><span>{count}</span></div>{children}</div>; }
function EmptyMini() { return <div className="grid aspect-[5/7] w-[74px] place-items-center rounded-[9px] border border-dashed border-td-ink/[0.08] text-[11px] text-td-muted">Empty</div>; }
function MiniStat({ label, value }: { label: string; value: number }) { return <div className="flex items-center justify-between text-[11px]"><span className="text-td-muted">{label}</span><span className="font-semibold text-td-secondary">{value}</span></div>; }

function ZoneDrawer({ title, cards, onClose, onReturn, onSwitch }: { title: string; cards: TestCard[]; onClose: () => void; onReturn: (card: TestCard) => void; onSwitch: (card: TestCard) => void }) {
  return <div className="absolute inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-sm" onClick={onClose}><section className="h-full w-full max-w-lg border-l border-td-accent/[0.14] bg-td-surface p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-td-accent-text">Zone explorer</p><h3 className="mt-1 text-xl font-semibold">{title} <span className="text-td-muted">({cards.length})</span></h3></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-td-ink/[0.08] text-td-secondary"><X className="h-4 w-4" /></button></div><div className="mt-5 flex items-center gap-2 rounded-xl border border-td-ink/[0.07] bg-black/20 px-3 py-2 text-td-muted"><Search className="h-4 w-4" /><span className="text-xs">Cards in this zone</span></div><div className="mt-5 grid grid-cols-2 gap-4 overflow-y-auto pb-8 sm:grid-cols-3">{cards.map((card) => <div key={card.instanceId} className="rounded-2xl border border-td-ink/[0.06] bg-td-ink/[0.02] p-2"><CardFace card={card} size="board" /><p className="mt-2 truncate text-[11px] font-semibold text-td-secondary">{card.name}</p><div className="mt-2 grid gap-1"><button type="button" onClick={() => onReturn(card)} className="h-8 rounded-lg bg-td-accent text-[11px] font-bold text-td-on-accent">Return to hand</button><button type="button" onClick={() => onSwitch(card)} className="h-7 text-[11px] font-semibold text-td-muted">Move to {title === "Graveyard" ? "exile" : "graveyard"}</button></div></div>)}</div></section></div>;
}
