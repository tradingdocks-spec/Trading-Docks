"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Columns3,
  Download,
  Grid3X3,
  Eye,
  ImageIcon,
  Layers3,
  List,
  MapPin,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Share2,
  Trash2,
  WalletCards,
  WandSparkles,
  X,
} from "lucide-react";

import { deckAnalytics } from "@/lib/deck-vault/analytics";
import {
  evaluateCommanderBracket,
} from "@/lib/deck-vault/brackets";
import type {
  DeckCard,
  DeckFormat,
  DeckRecord,
  DeckIntelligenceReport,
  InventoryMatch,
  ManaColor,
  ScryfallCardResult,
} from "@/lib/deck-vault/types";
import { ManaPips } from "./ManaPips";
import { saveDeckRecord } from "@/lib/deck-vault/persistence";
import { loadInventorySnapshot } from "@/lib/inventory-persistence";

type StoredInventoryItem = {
  id?: string;
  inventoryId?: string;
  name?: string;
  quantity?: number;
  locationId?: string;
  location?: string;
  condition?: string;
  set?: string;
  collectorNumber?: string;
  binderPage?: number;
  binderSlot?: string;
  marketplaceListings?: Array<{
    platform?: string;
    listingId?: string;
    status?: string;
  }>;
};

type StoredInventoryLocation = {
  id?: string;
  name?: string;
  type?: string;
};

async function loadOwnedCollection() {
  const snapshot = await loadInventorySnapshot();
  const items = snapshot.items as unknown as StoredInventoryItem[];
  const locations = snapshot.locations as unknown as StoredInventoryLocation[];
  const locationById = new Map(
    locations
      .filter((location) => location.id)
      .map((location) => [location.id as string, location]),
  );

  return items
    .filter((item) => item.name && Number(item.quantity) > 0)
    .map((item) => {
      const location = item.locationId
        ? locationById.get(item.locationId)
        : undefined;
      const locationName =
        location?.name?.trim() || item.location?.trim() || "Location not assigned";
      const activeListing = item.marketplaceListings?.find(
        (listing) => listing.status === "Active",
      );

      return {
        inventoryId: item.id ?? item.inventoryId ?? `${item.name}:${item.locationId ?? locationName}`,
        name: item.name as string,
        quantity: Number(item.quantity) || 0,
        location: locationName,
        locationId: item.locationId,
        locationType: location?.type,
        binderPage: item.binderPage,
        binderSlot: item.binderSlot,
        condition: item.condition ?? "Not specified",
        printing:
          [item.set, item.collectorNumber ? `#${item.collectorNumber}` : ""]
            .filter(Boolean)
            .join(" · ") || undefined,
        platform: activeListing?.platform,
        listingId: activeListing?.listingId,
      };
    });
}

const manaStyles: Record<ManaColor, string> = {
  W: "bg-amber-100",
  U: "bg-sky-400",
  B: "bg-violet-700",
  R: "bg-rose-500",
  G: "bg-emerald-500",
  C: "bg-slate-500",
};

function displayCommanderColors(
  colors: ManaColor[],
) {
  const unique = Array.from(
    new Set(colors),
  );

  const colored = unique.filter(
    (color) => color !== "C",
  );

  // Colorless is shown only when the commander itself has no colored identity.
  return colored.length
    ? colored
    : unique.includes("C")
      ? (["C"] as ManaColor[])
      : [];
}

const FORMATS: DeckFormat[] = [
  "EDH",
  "Pauper EDH",
  "Standard",
  "Modern",
  "Pioneer",
  "Legacy",
  "Vintage",
  "Alchemy",
  "Premodern",
  "Pauper",
];

export function DeckDetailWorkspace({
  deck,
}: {
  deck: DeckRecord;
}) {
  const [tab, setTab] = useState("Overview");
  const [format, setFormat] =
    useState<DeckFormat>(
      String(deck.format) === "Commander"
        ? "EDH"
        : deck.format,
    );
  const [cards, setCards] = useState<DeckCard[]>(
    deck.cards,
  );
  const [commanderName, setCommanderName] =
    useState(deck.commander ?? "");
  const [deckName, setDeckName] = useState(deck.name);
  const [commanderArt, setCommanderArt] =
    useState("");
  const [commanderImage, setCommanderImage] =
    useState("");
  const [commanderPickerOpen, setCommanderPickerOpen] =
    useState(false);
  const [commanderQuery, setCommanderQuery] =
    useState("");
  const [commanderResults, setCommanderResults] =
    useState<ScryfallCardResult[]>([]);
  const [commanderSearching, setCommanderSearching] =
    useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] =
    useState<ScryfallCardResult[]>([]);
  const [searching, setSearching] =
    useState(false);
  const [view, setView] = useState<DeckCardView>("table");
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [grouping, setGrouping] = useState<
    "type" | "role"
  >("type");
  const [intelligence, setIntelligence] =
    useState<DeckIntelligenceReport | null>(null);
  const [intelligenceLoading, setIntelligenceLoading] =
    useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState("");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const analytics = useMemo(
    () => deckAnalytics(cards),
    [cards],
  );
  const bracket = useMemo(
    () => evaluateCommanderBracket(cards),
    [cards],
  );
  const isCommander =
    format === "EDH" || format === "Pauper EDH";

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const mainCards = cards.filter(
        (card) =>
          card.board !== "commander" &&
          card.category !== "Commander",
      );
      const totalMain = mainCards.reduce(
        (sum, card) =>
          sum + card.quantity,
        0,
      );
      const ownedMain = mainCards.reduce(
        (sum, card) =>
          sum +
          (card.owned
            ? card.quantity
            : 0),
        0,
      );

      const updatedDeck: DeckRecord = {
        ...deck,
        name: deckName.trim() || deck.name,
        commander: commanderName,
        commanders: cards
          .filter(
            (card) =>
              card.board === "commander" ||
              card.category === "Commander",
          )
          .map((card) => card.name),
        format,
        colors: (() => {
          const commandZoneCards =
            cards.filter(
              (card) =>
                card.board ===
                  "commander" ||
                card.category ===
                  "Commander",
            );
          const sourceCards =
            commandZoneCards.length
              ? commandZoneCards
              : cards;
          const identity =
            Array.from(
              new Set(
                sourceCards.flatMap(
                  (card) =>
                    card.colors,
                ),
              ),
            ) as ManaColor[];
          const colored =
            identity.filter(
              (color) =>
                color !== "C",
            );

          return colored.length
            ? colored
            : identity;
        })(),
        marketValue: cards.reduce(
          (sum, card) =>
            sum +
            card.price * card.quantity,
          0,
        ),
        ownedCount: totalMain
          ? Math.round(
              (ownedMain / totalMain) *
                100,
            )
          : 0,
        cardCount:
          totalMain +
          cards.filter(
            (card) =>
              card.board === "commander" ||
              card.category === "Commander",
          ).length,
        updatedAt: "Just now",
        cards,
      };

      setSaveState("saving");
      setSaveError("");
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(() => saveDeckRecord(updatedDeck))
        .then(() => {
          setSaveState("saved");
        })
        .catch((error) => {
          setSaveState("error");
          setSaveError(
            error instanceof Error
              ? error.message
              : "Your deck changes could not be saved.",
          );
        });
    }, 350);

    return () =>
      window.clearTimeout(timeout);
  }, [
    cards,
    commanderName,
    deckName,
    format,
    deck,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(
      async () => {
        setIntelligenceLoading(true);

        try {
          const inventory = await loadOwnedCollection();

          const response = await fetch(
            "/api/deck-vault/intelligence",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                cards,
                format,
                inventory,
              }),
            },
          );

          if (!response.ok) return;

          const payload =
            (await response.json()) as DeckIntelligenceReport & {
              cards?: Array<{
                id: string;
                legalityStatus: DeckCard["legalityStatus"];
                legalityMessage: string;
              }>;
            };

          setIntelligence(payload);

          if (payload.cards?.length) {
            const legalityById = new Map(
              payload.cards.map((card) => [
                card.id,
                card,
              ]),
            );

            setCards((current) =>
              current.map((card) => {
                const legality =
                  legalityById.get(
                    card.id,
                  );
                const ownership =
                  payload.ownership.find(
                    (entry) =>
                      entry.cardId ===
                      card.id,
                  );

                return {
                  ...card,
                  legalityStatus:
                    legality?.legalityStatus ??
                    "legal",
                  legalityMessage:
                    legality?.legalityMessage ??
                    "",
                  inventoryMatches:
                    ownership?.matches ?? [],
                  ownedQuantity:
                    ownership?.owned ?? 0,
                  owned:
                    (ownership?.owned ?? 0) >=
                    card.quantity,
                };
              }),
            );
          }
        } finally {
          setIntelligenceLoading(false);
        }
      },
      450,
    );

    return () =>
      window.clearTimeout(timeout);
  }, [format, cards.map((card) => `${card.id}:${card.quantity}:${card.board}`).join("|")]);

  useEffect(() => {
    if (!commanderName || !isCommander) return;

    const params = new URLSearchParams({
      name: commanderName,
    });

    fetch(
      `/api/deck-vault/commander-art?${params.toString()}`,
    )
      .then((response) => response.json())
      .then((payload) => {
        setCommanderArt(payload.artCrop ?? "");
        setCommanderImage(payload.image ?? "");
      })
      .catch(() => {});
  }, [commanderName, isCommander]);

  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setSearching(true);

      try {
        const params = new URLSearchParams({
          q: search.trim(),
        });
        const response = await fetch(
          `/api/deck-vault/card-search?${params.toString()}`,
        );
        const payload = await response.json();
        setSearchResults(payload.results ?? []);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!commanderPickerOpen || commanderQuery.trim().length < 2) {
      setCommanderResults([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setCommanderSearching(true);

      try {
        const params = new URLSearchParams({
          q: `${commanderQuery.trim()} is:commander`,
        });
        const response = await fetch(
          `/api/deck-vault/card-search?${params.toString()}`,
        );
        const payload = await response.json();
        setCommanderResults(payload.results ?? []);
      } finally {
        setCommanderSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [commanderQuery, commanderPickerOpen]);

  function selectCommander(result: ScryfallCardResult) {
    const nextCommander: DeckCard = {
      id: result.id,
      name: result.name,
      quantity: 1,
      manaValue: result.manaValue,
      colors: result.colorIdentity.length
        ? result.colorIdentity
        : result.colors.length
          ? result.colors
          : ["C"],
      typeLine: result.typeLine,
      category: "Commander",
      price: result.price,
      owned: false,
      image: result.image,
      artCrop: result.artCrop,
      setCode: result.setCode,
      collectorNumber: result.collectorNumber,
      gameChanger: result.gameChanger,
      board: "commander",
    };

    setCards((current) => [
      nextCommander,
      ...current.filter(
        (card) =>
          card.board !== "commander" &&
          card.category !== "Commander",
      ),
    ]);
    setCommanderName(result.name);
    setCommanderImage(result.image);
    setCommanderArt(result.artCrop);
    setCommanderPickerOpen(false);
    setCommanderQuery("");
    setCommanderResults([]);
  }

  function addCard(result: ScryfallCardResult) {
    setCards((current) => {
      const existing = current.find(
        (card) => card.id === result.id,
      );

      if (existing) {
        return current.map((card) =>
          card.id === result.id
            ? {
                ...card,
                quantity: card.quantity + 1,
              }
            : card,
        );
      }

      return [
        ...current,
        {
          id: result.id,
          name: result.name,
          quantity: 1,
          manaValue: result.manaValue,
          colors: result.colors.length
            ? result.colors
            : ["C"],
          typeLine: result.typeLine,
          category: inferCategory(result),
          price: result.price,
          owned: false,
          image: result.image,
          artCrop: result.artCrop,
          setCode: result.setCode,
          collectorNumber:
            result.collectorNumber,
          gameChanger: result.gameChanger,
          board: "main",
        },
      ];
    });
  }

  function removeCard(id: string) {
    setCards((current) =>
      current
        .map((card) =>
          card.id === id
            ? {
                ...card,
                quantity: card.quantity - 1,
              }
            : card,
        )
        .filter((card) => card.quantity > 0),
    );
  }

  const commanderCard = useMemo(
    () =>
      cards.find(
        (card) =>
          card.board === "commander" ||
          card.category === "Commander",
      ),
    [cards],
  );

  const mainDeckCards = useMemo(
    () =>
      cards.filter(
        (card) =>
          !isCommander ||
          (card.id !== commanderCard?.id &&
            card.board !== "commander" &&
            card.category !== "Commander"),
      ),
    [cards, commanderCard, isCommander],
  );

  const groupedCards = useMemo(() => {
    if (grouping === "role") {
      const roles = [
        "Ramp",
        "Card Draw",
        "Removal",
        "Board Wipe",
        "Protection",
        "Tutor",
        "Proliferate",
        "Land",
        "Other",
      ];

      return roles
        .map((group) => ({
          group,
          cards: mainDeckCards.filter((card) =>
            group === "Other"
              ? !roles
                  .slice(0, -1)
                  .includes(card.category)
              : card.category === group,
          ),
        }))
        .filter((entry) => entry.cards.length);
    }

    const types = [
      "Creature",
      "Instant",
      "Sorcery",
      "Artifact",
      "Enchantment",
      "Planeswalker",
      "Land",
      "Other",
    ];

    return types
      .map((group) => ({
        group,
        cards: mainDeckCards.filter((card) =>
          group === "Other"
            ? !types
                .slice(0, -1)
                .some((type) =>
                  card.typeLine.includes(type),
                )
            : card.typeLine.includes(group),
        ),
      }))
      .filter((entry) => entry.cards.length);
  }, [mainDeckCards, grouping]);

  return (
    <main className="min-h-screen bg-[#020912] px-5 py-7 text-white sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1540px]">
        <DeckHero
          deck={deck}
          deckName={deckName}
          setDeckName={setDeckName}
          format={format}
          setFormat={setFormat}
          commanderName={commanderName}
          commanderArt={commanderArt}
          commanderImage={commanderImage}
          commanderColors={
            commanderCard?.colors ?? []
          }
          isCommander={isCommander}
          commanderPickerOpen={commanderPickerOpen}
          setCommanderPickerOpen={setCommanderPickerOpen}
          commanderQuery={commanderQuery}
          setCommanderQuery={setCommanderQuery}
          commanderResults={commanderResults}
          commanderSearching={commanderSearching}
          selectCommander={selectCommander}
        />
        <div
          className={[
            "mt-3 flex items-center justify-between rounded-xl border px-4 py-2 text-xs",
            saveState === "error"
              ? "border-rose-300/20 bg-rose-400/10 text-rose-100"
              : "border-white/[0.06] bg-[#06131f] text-slate-400",
          ].join(" ")}
          role={saveState === "error" ? "alert" : "status"}
        >
          <span>
            {saveState === "saving"
              ? "Saving this deck to your account…"
              : saveState === "error"
                ? saveError
                : "Saved to your Trading Docks account"}
          </span>
          {saveState === "saved" ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : null}
        </div>

        <nav className="mt-5 flex gap-2 overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#06131f] p-2">
          {[
            "Overview",
            "Cards",
            "Analytics",
            "Intelligence",
            "Tokens",
            "Ownership",
            "Prices",
            "Playtest",
            "History",
          ].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={[
                "h-10 rounded-xl px-4 text-[9px] font-semibold transition",
                tab === item
                  ? "bg-sky-300 text-[#00121c]"
                  : "text-slate-600 hover:bg-white/[0.025] hover:text-slate-300",
              ].join(" ")}
            >
              {item}
            </button>
          ))}
        </nav>

        {tab === "Cards" ? (
          <CardsWorkspace
            cards={cards}
            commanderCard={commanderCard}
            mainDeckCards={mainDeckCards}
            groupedCards={groupedCards}
            search={search}
            setSearch={setSearch}
            searchResults={searchResults}
            searching={searching}
            addCard={addCard}
            removeCard={removeCard}
            view={view}
            setView={setView}
            showcaseOpen={showcaseOpen}
            setShowcaseOpen={setShowcaseOpen}
            deckName={deckName}
            commanderName={commanderName}
            grouping={grouping}
            setGrouping={setGrouping}
            format={format}
            isCommander={isCommander}
            setCommanderPickerOpen={setCommanderPickerOpen}
          />
        ) : tab === "Intelligence" ? (
          <IntelligenceWorkspace
            report={intelligence}
            loading={intelligenceLoading}
            format={format}
          />
        ) : tab === "Tokens" ? (
          <TokenWorkspace
            report={intelligence}
            loading={intelligenceLoading}
          />
        ) : tab === "Ownership" ? (
          <OwnershipIntelligenceWorkspace
            report={intelligence}
            loading={intelligenceLoading}
          />
        ) : (
          <AnalyticsWorkspace
            deck={deck}
            cards={cards}
            analytics={analytics}
            bracket={bracket}
            isCommander={isCommander}
            format={format}
            commanderName={commanderName}
            intelligence={intelligence}
            openCards={() => setTab("Cards")}
          />
        )}
      </div>
    </main>
  );
}

function DeckHero({
  deck,
  deckName,
  setDeckName,
  format,
  setFormat,
  commanderName,
  commanderArt,
  commanderImage,
  commanderColors,
  isCommander,
  commanderPickerOpen,
  setCommanderPickerOpen,
  commanderQuery,
  setCommanderQuery,
  commanderResults,
  commanderSearching,
  selectCommander,
}: {
  deck: DeckRecord;
  deckName: string;
  setDeckName: (name: string) => void;
  format: DeckFormat;
  setFormat: (format: DeckFormat) => void;
  commanderName: string;
  commanderArt: string;
  commanderImage: string;
  commanderColors: ManaColor[];
  isCommander: boolean;
  commanderPickerOpen: boolean;
  setCommanderPickerOpen: (open: boolean) => void;
  commanderQuery: string;
  setCommanderQuery: (value: string) => void;
  commanderResults: ScryfallCardResult[];
  commanderSearching: boolean;
  selectCommander: (result: ScryfallCardResult) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(deckName);

  function commitName() {
    const nextName = draftName.trim();
    if (!nextName) return;
    setDeckName(nextName);
    setEditingName(false);
  }

  return (
    <>
      <header className="relative min-h-[300px] overflow-hidden rounded-[30px] border border-sky-300/[0.12] bg-[#06131f]">
        {commanderArt && isCommander ? (
          <>
            <img
              src={commanderArt}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center opacity-55"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#030b13] via-[#030b13]/90 to-[#030b13]/15" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030b13] via-transparent to-black/15" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(56,189,248,0.15),transparent_35%),radial-gradient(circle_at_35%_85%,rgba(139,92,246,0.12),transparent_38%)]" />
        )}

        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-100 via-sky-400 via-violet-700 via-rose-500 to-emerald-500 opacity-80" />

        <div className="relative flex min-h-[300px] flex-col justify-end gap-6 p-6 sm:p-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-end gap-5">
            {commanderImage && isCommander ? (
              <img
                src={commanderImage}
                alt={commanderName || "Commander"}
                className="hidden h-[184px] w-[132px] rounded-2xl border border-white/[0.12] object-cover shadow-2xl sm:block"
              />
            ) : null}

            <div>
              <ManaSymbols
                colors={
                  isCommander
                    ? displayCommanderColors(
                        commanderColors,
                      )
                    : displayCommanderColors(
                        deck.colors,
                      )
                }
                size="lg"
              />
              <p className="mt-5 text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-300">
                {format} · {deck.theme}
              </p>
              {editingName ? (
                <div className="mt-2 flex max-w-2xl items-center gap-2">
                  <input autoFocus value={draftName} maxLength={80} onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => {
                    if (event.key === "Enter") commitName();
                    if (event.key === "Escape") {
                      setDraftName(deckName);
                      setEditingName(false);
                    }
                  }} className="h-14 min-w-0 flex-1 rounded-xl border border-sky-300/30 bg-[#03101a]/90 px-4 text-2xl font-semibold text-white outline-none sm:text-3xl" />
                  <button type="button" onClick={commitName} className="flex h-12 items-center rounded-xl bg-sky-300 px-4 text-sm font-semibold text-[#00121c]">Save</button>
                  <button type="button" onClick={() => {
                    setDraftName(deckName);
                    setEditingName(false);
                  }} className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 text-slate-300" aria-label="Cancel rename"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">
                    {deckName}
                  </h1>
                  <button type="button" onClick={() => {
                    setDraftName(deckName);
                    setEditingName(true);
                  }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-slate-300 transition hover:border-sky-300/30 hover:text-sky-200" aria-label="Rename deck" title="Rename deck">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              )}
              <p className="mt-3 text-sm text-slate-400">
                {isCommander && commanderName
                  ? `Commander: ${commanderName}`
                  : `${format} constructed deck`}
              </p>

              {isCommander ? (
                <button
                  type="button"
                  onClick={() => setCommanderPickerOpen(true)}
                  className="mt-4 h-10 rounded-xl border border-cyan-300/[0.18] bg-cyan-400/[0.045] px-4 text-[9px] font-semibold text-cyan-200 transition hover:border-cyan-200/40 hover:bg-cyan-400/[0.08]"
                >
                  Change Commander
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <label className="block">
              <span className="text-[7px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                View as format
              </span>
              <select
                value={format}
                onChange={(event) =>
                  setFormat(
                    event.target.value as DeckFormat,
                  )
                }
                className="mt-2 h-11 w-full min-w-[190px] rounded-xl border border-white/[0.1] bg-[#06131f]/90 px-3 text-[10px] font-semibold text-white outline-none backdrop-blur"
              >
                {FORMATS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <HeaderMetric
                label="Cards"
                value={`${deck.cardCount}`}
              />
              <HeaderMetric
                label="Value"
                value={`$${deck.marketValue.toFixed(2)}`}
              />
              <HeaderMetric
                label="Owned"
                value={`${deck.ownedCount}%`}
              />
              <HeaderMetric
                label="Power"
                value={`${deck.power.toFixed(1)}/10`}
              />
            </div>
          </div>
        </div>
      </header>

      {commanderPickerOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <section className="max-h-[82vh] w-full max-w-3xl overflow-hidden rounded-[26px] border border-cyan-300/[0.16] bg-[#06131f] shadow-[0_30px_100px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between border-b border-white/[0.06] p-5">
              <div>
                <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-cyan-300">
                  Change Commander
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  Choose a legendary commander
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCommanderPickerOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] text-slate-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              <label className="flex h-12 items-center gap-3 rounded-xl border border-white/[0.08] bg-black/[0.14] px-4">
                <Search className="h-4 w-4 text-slate-700" />
                <input
                  value={commanderQuery}
                  onChange={(event) =>
                    setCommanderQuery(event.target.value)
                  }
                  placeholder="Search commanders..."
                  className="min-w-0 flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-slate-700"
                />
              </label>

              <div className="mt-4 grid max-h-[56vh] gap-3 overflow-y-auto sm:grid-cols-2">
                {commanderResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => selectCommander(result)}
                    className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-3 text-left transition hover:border-cyan-300/[0.18] hover:bg-cyan-400/[0.025]"
                  >
                    {result.image ? (
                      <img
                        src={result.image}
                        alt={result.name}
                        className="h-24 w-[68px] rounded-xl object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-white">
                        {result.name}
                      </p>
                      <p className="mt-1 text-[7px] text-slate-600">
                        {result.typeLine}
                      </p>
                      <div className="mt-3">
                        <ManaSymbols
                          colors={
                            result.colorIdentity.length
                              ? result.colorIdentity
                              : result.colors
                          }
                          size="sm"
                        />
                      </div>
                    </div>
                    <Check className="h-4 w-4 shrink-0 text-cyan-300" />
                  </button>
                ))}

                {commanderSearching ? (
                  <p className="col-span-full py-10 text-center text-[9px] text-slate-600">
                    Searching commanders...
                  </p>
                ) : null}

                {!commanderSearching &&
                commanderQuery.trim().length >= 2 &&
                !commanderResults.length ? (
                  <p className="col-span-full py-10 text-center text-[9px] text-slate-600">
                    No matching commanders found.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
type DeckCardView =
  | "table"
  | "columns"
  | "grid"
  | "stacks"
  | "role"
  | "stats";

function CardsWorkspace({
  cards,
  commanderCard,
  mainDeckCards,
  groupedCards,
  search,
  setSearch,
  searchResults,
  searching,
  addCard,
  removeCard,
  view,
  setView,
  showcaseOpen,
  setShowcaseOpen,
  deckName,
  commanderName,
  grouping,
  setGrouping,
  format,
  isCommander,
  setCommanderPickerOpen,
}: {
  cards: DeckCard[];
  commanderCard?: DeckCard;
  mainDeckCards: DeckCard[];
  groupedCards: Array<{
    group: string;
    cards: DeckCard[];
  }>;
  search: string;
  setSearch: (value: string) => void;
  searchResults: ScryfallCardResult[];
  searching: boolean;
  addCard: (card: ScryfallCardResult) => void;
  removeCard: (id: string) => void;
  view: DeckCardView;
  setView: (view: DeckCardView) => void;
  showcaseOpen: boolean;
  setShowcaseOpen: (open: boolean) => void;
  deckName: string;
  commanderName: string;
  grouping: "type" | "role";
  setGrouping: (grouping: "type" | "role") => void;
  format: DeckFormat;
  isCommander: boolean;
  setCommanderPickerOpen: (open: boolean) => void;
}) {
  const [selectedCardId, setSelectedCardId] =
    useState<string | null>(
      mainDeckCards[0]?.id ?? null,
    );
  const [selectedIds, setSelectedIds] =
    useState<string[]>([]);
  const [typeFilter, setTypeFilter] =
    useState("All");
  const [ownershipFilter, setOwnershipFilter] =
    useState<"all" | "owned" | "missing">(
      "all",
    );
  const [sortKey, setSortKey] = useState<
    "name" | "type" | "mana" | "price" | "quantity"
  >("name");
  const [sortDirection, setSortDirection] =
    useState<"asc" | "desc">("asc");

  const mainDeckCount = mainDeckCards.reduce(
    (sum, card) => sum + card.quantity,
    0,
  );
  const mainDeckValue = mainDeckCards.reduce(
    (sum, card) => sum + card.price * card.quantity,
    0,
  );
  const owned = mainDeckCards.reduce(
    (sum, card) =>
      sum +
      Math.min(
        card.quantity,
        card.ownedQuantity ??
          (card.owned ? card.quantity : 0),
      ),
    0,
  );
  const missing = Math.max(
    0,
    mainDeckCount - owned,
  );
  const uniqueCardCount = mainDeckCards.length;
  const singletonFormat =
    format === "EDH" ||
    format === "Pauper EDH";
  const copyLimit = singletonFormat ? 1 : 4;

  const typeOptions = [
    "All",
    "Creature",
    "Instant",
    "Sorcery",
    "Artifact",
    "Enchantment",
    "Planeswalker",
    "Land",
  ];

  const filteredCards = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return [...mainDeckCards]
      .filter((card) => {
        const matchesSearch =
          !normalized ||
          card.name.toLowerCase().includes(normalized) ||
          card.typeLine.toLowerCase().includes(normalized) ||
          card.category.toLowerCase().includes(normalized);

        const matchesType =
          typeFilter === "All" ||
          card.typeLine.includes(typeFilter);

        const matchesOwnership =
          ownershipFilter === "all" ||
          (ownershipFilter === "owned"
            ? card.owned
            : !card.owned);

        return (
          matchesSearch &&
          matchesType &&
          matchesOwnership
        );
      })
      .sort((a, b) => {
        const direction =
          sortDirection === "asc" ? 1 : -1;

        if (sortKey === "name") {
          return (
            a.name.localeCompare(b.name) *
            direction
          );
        }
        if (sortKey === "type") {
          return (
            a.typeLine.localeCompare(
              b.typeLine,
            ) * direction
          );
        }
        if (sortKey === "mana") {
          return (
            (a.manaValue - b.manaValue) *
            direction
          );
        }
        if (sortKey === "price") {
          return (
            (a.price - b.price) * direction
          );
        }

        return (
          (a.quantity - b.quantity) *
          direction
        );
      });
  }, [
    mainDeckCards,
    search,
    typeFilter,
    ownershipFilter,
    sortKey,
    sortDirection,
  ]);

  const selectedCard =
    mainDeckCards.find(
      (card) => card.id === selectedCardId,
    ) ??
    filteredCards[0] ??
    mainDeckCards[0];

  const roleGroups = useMemo(() => {
    const roles = [
      "Ramp",
      "Card Draw",
      "Removal",
      "Board Wipe",
      "Protection",
      "Tutor",
      "Proliferate",
      "Land",
      "Other",
    ];

    return roles
      .map((role) => ({
        role,
        cards: mainDeckCards.filter((card) =>
          role === "Other"
            ? !roles
                .slice(0, -1)
                .includes(card.category)
            : card.category === role,
        ),
      }))
      .filter((group) => group.cards.length);
  }, [mainDeckCards]);

  const summaryByType = useMemo(
    () =>
      typeOptions
        .slice(1)
        .map((type) => {
          const typeCards =
            mainDeckCards.filter((card) =>
              card.typeLine.includes(type),
            );
          return {
            type,
            copies: typeCards.reduce(
              (sum, card) =>
                sum + card.quantity,
              0,
            ),
            unique: typeCards.length,
            value: typeCards.reduce(
              (sum, card) =>
                sum +
                card.price * card.quantity,
              0,
            ),
          };
        })
        .filter((entry) => entry.copies),
    [mainDeckCards],
  );

  async function addBasicLand(name: string) {
    const params = new URLSearchParams({
      q: name,
      basic: "true",
    });

    const response = await fetch(
      `/api/deck-vault/card-search?${params.toString()}`,
    );

    if (!response.ok) return;

    const payload = await response.json();
    const result = payload.results?.[0];

    if (result) {
      addCard(result);
    }
  }

  function changeSort(
    nextKey:
      | "name"
      | "type"
      | "mana"
      | "price"
      | "quantity",
  ) {
    if (sortKey === nextKey) {
      setSortDirection((direction) =>
        direction === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter(
            (selected) => selected !== id,
          )
        : [...current, id],
    );
  }

  function removeSelected() {
    selectedIds.forEach((id) =>
      removeCard(id),
    );
    setSelectedIds([]);
  }

  return (
    <section className="mt-5 space-y-5">
      <section className="sticky top-3 z-40 overflow-hidden rounded-[24px] border border-cyan-300/[0.11] bg-[#04101a]/95 shadow-[0_24px_70px_rgba(0,0,0,0.38)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 border-b border-white/[0.055] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.13em] text-cyan-300">
                Command Deck Editor
              </p>
              <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] text-slate-400">
                {mainDeckCount} cards
              </span>
              <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] text-slate-400">
                {uniqueCardCount} unique
              </span>
              <span className="rounded-full border border-emerald-300/[0.1] bg-emerald-400/[0.025] px-2.5 py-1 text-[11px] text-emerald-200">
                ${mainDeckValue.toFixed(2)}
              </span>
            </div>
            <p className="mt-2 text-[13px] text-slate-500">
              One workspace for table editing, visual review, roles, filters, and live card inspection.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowcaseOpen(true)}
              className="flex h-10 items-center gap-2 rounded-xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-400 px-4 text-[12px] font-bold text-[#00121c] shadow-[0_0_30px_rgba(34,211,238,0.14)] transition hover:brightness-110"
            >
              <Share2 className="h-4 w-4" />
              Show Off Your Deck
            </button>
            {[
              {
                value: "table" as const,
                label: "Text",
                icon: List,
              },
              {
                value: "columns" as const,
                label: "Columns",
                icon: Columns3,
              },
              {
                value: "grid" as const,
                label: "Visual Grid",
                icon: Grid3X3,
              },
              {
                value: "stacks" as const,
                label: "Stacks",
                icon: Layers3,
              },
              {
                value: "role" as const,
                label: "Role",
                icon: ImageIcon,
              },
              {
                value: "stats" as const,
                label: "Analytics",
                icon: BarChart3,
              },
            ].map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => {
                    setView(mode.value);
                    if (mode.value === "role") {
                      setGrouping("role");
                    }
                  }}
                  className={[
                    "flex h-10 items-center gap-2 rounded-xl border px-3.5 text-[12px] font-semibold transition",
                    view === mode.value
                      ? "border-cyan-200/25 bg-cyan-300 text-[#00121c]"
                      : "border-white/[0.07] bg-white/[0.015] text-slate-400 hover:border-cyan-300/[0.14] hover:text-cyan-200",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(260px,1fr)_180px_160px_auto]">
          <label className="flex h-11 items-center gap-3 rounded-xl border border-white/[0.075] bg-black/[0.15] px-3">
            <Search className="h-4 w-4 text-slate-600" />
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search card, type, or role..."
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-slate-700"
            />
          </label>

          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value)
            }
            className="h-11 rounded-xl border border-white/[0.075] bg-[#06131f] px-3 text-[12px] text-slate-300 outline-none"
          >
            {typeOptions.map((option) => (
              <option key={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={ownershipFilter}
            onChange={(event) =>
              setOwnershipFilter(
                event.target.value as
                  | "all"
                  | "owned"
                  | "missing",
              )
            }
            className="h-11 rounded-xl border border-white/[0.075] bg-[#06131f] px-3 text-[12px] text-slate-300 outline-none"
          >
            <option value="all">
              All ownership
            </option>
            <option value="owned">
              Owned
            </option>
            <option value="missing">
              Missing
            </option>
          </select>

          <div className="flex gap-2">
            {isCommander ? <button
              type="button"
              onClick={() =>
                setCommanderPickerOpen(true)
              }
              className="h-11 rounded-xl border border-violet-300/[0.15] bg-violet-400/[0.035] px-4 text-[12px] font-semibold text-violet-200"
            >
              Change Commander
            </button> : null}
            {selectedIds.length ? (
              <button
                type="button"
                onClick={removeSelected}
                className="h-11 rounded-xl border border-rose-300/[0.15] bg-rose-400/[0.04] px-4 text-[12px] font-semibold text-rose-200"
              >
                Delete {selectedIds.length}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[230px_minmax(0,1fr)_310px]">
        <aside className="space-y-4 xl:sticky xl:top-[190px] xl:self-start">
          {isCommander && commanderCard ? (
            <section className="overflow-hidden rounded-[22px] border border-violet-300/[0.12] bg-[#06131f] shadow-[0_22px_60px_rgba(0,0,0,0.26)]">
              <div className="border-b border-white/[0.055] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-violet-300">
                  Commander
                </p>
              </div>

              <div className="p-4">
                <div className="mx-auto w-full max-w-[190px] overflow-hidden rounded-[18px] border border-white/[0.1] bg-black/30 shadow-[0_18px_50px_rgba(0,0,0,0.38),0_0_24px_rgba(139,92,246,0.10)]">
                  <img
                    src={
                      commanderCard.image ||
                      `/api/deck-vault/card-image?name=${encodeURIComponent(
                        commanderCard.name,
                      )}`
                    }
                    alt={commanderCard.name}
                    loading="eager"
                    className="aspect-[0.715] w-full object-cover"
                  />
                </div>

                <p className="mt-4 text-center text-[14px] font-semibold leading-5 text-white">
                  {commanderCard.name}
                </p>

                <div className="mt-3 flex items-center justify-center">
                  <ManaSymbols
                    colors={commanderCard.colors}
                    size="sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setCommanderPickerOpen(true)
                  }
                  className="mt-4 h-10 w-full rounded-xl border border-violet-300/[0.14] bg-violet-400/[0.04] text-[12px] font-semibold text-violet-100 transition hover:border-violet-200/30 hover:bg-violet-400/[0.07]"
                >
                  Change Commander
                </button>
              </div>
            </section>
          ) : null}

          <section className="rounded-[22px] border border-white/[0.065] bg-[#06131f] p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.11em] text-slate-500">
              Deck Explorer
            </p>
            <div className="mt-3 space-y-1.5">
              <ExplorerRow
                label="All Cards"
                value={mainDeckCount}
                active={typeFilter === "All"}
                onClick={() =>
                  setTypeFilter("All")
                }
              />
              {summaryByType.map((entry) => (
                <ExplorerRow
                  key={entry.type}
                  label={entry.type}
                  value={entry.copies}
                  active={
                    typeFilter === entry.type
                  }
                  onClick={() =>
                    setTypeFilter(entry.type)
                  }
                />
              ))}
            </div>
          </section>

          <section className="rounded-[22px] border border-white/[0.065] bg-[#06131f] p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.11em] text-slate-500">
              Quick Add Basics
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {[
                {
                  name: "Plains",
                  color: "W" as ManaColor,
                },
                {
                  name: "Island",
                  color: "U" as ManaColor,
                },
                {
                  name: "Swamp",
                  color: "B" as ManaColor,
                },
                {
                  name: "Mountain",
                  color: "R" as ManaColor,
                },
                {
                  name: "Forest",
                  color: "G" as ManaColor,
                },
              ].map((land) => (
                <button
                  key={land.name}
                  type="button"
                  onClick={() =>
                    void addBasicLand(land.name)
                  }
                  className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.012] px-2.5 py-2 text-[11px] text-slate-400 transition hover:border-cyan-300/[0.14] hover:text-cyan-200"
                >
                  <ManaSymbols
                    colors={[land.color]}
                    size="sm"
                  />
                  <span className="truncate">
                    {land.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="min-w-0">
          {searchResults.length ? (
            <section className="mb-4 rounded-[22px] border border-cyan-300/[0.11] bg-[#06131f] p-4">
              <p className="text-[12px] font-semibold text-cyan-200">
                Add cards
              </p>
              <div className="mt-3 grid max-h-[260px] gap-2 overflow-y-auto sm:grid-cols-2">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() =>
                      addCard(result)
                    }
                    className="flex items-center gap-3 rounded-xl border border-white/[0.055] bg-white/[0.015] p-2 text-left transition hover:border-cyan-300/[0.16]"
                  >
                    {result.image ? (
                      <img
                        src={result.image}
                        alt={result.name}
                        className="h-16 w-12 rounded-lg object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-white">
                        {result.name}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {result.setName} · $
                        {result.price.toFixed(2)}
                      </p>
                    </div>
                    <Plus className="h-4 w-4 text-cyan-300" />
                  </button>
                ))}
              </div>
            </section>
          ) : searching ? (
            <p className="mb-4 rounded-xl border border-white/[0.05] bg-[#06131f] p-4 text-[12px] text-slate-500">
              Searching Scryfall...
            </p>
          ) : null}

          {view === "table" ? (
            <section className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#06131f]">
              <div className="flex items-center justify-between border-b border-white/[0.055] px-5 py-4">
                <div>
                  <p className="text-[17px] font-semibold text-white">
                    Entire Deck List
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {filteredCards.length} unique cards shown · compact desktop table
                  </p>
                </div>
                <span className="text-[12px] text-slate-500">
                  {owned} owned · {missing} missing
                </span>
              </div>

              <div className="max-h-[calc(100vh-255px)] overflow-y-auto overflow-x-hidden">
                <table className="w-full table-fixed border-collapse text-left">
                  <thead className="sticky top-0 z-20 bg-[#071824] shadow-[0_1px_0_rgba(255,255,255,0.07)]">
                    <tr>
                      <th className="w-10 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={
                            filteredCards.length > 0 &&
                            filteredCards.every(
                              (card) =>
                                selectedIds.includes(
                                  card.id,
                                ),
                            )
                          }
                          onChange={(event) =>
                            setSelectedIds(
                              event.target.checked
                                ? filteredCards.map(
                                    (card) =>
                                      card.id,
                                  )
                                : [],
                            )
                          }
                          aria-label="Select all cards"
                        />
                      </th>
                      <TableHeading
                        label="Qty"
                        className="w-14"
                        active={
                          sortKey === "quantity"
                        }
                        direction={sortDirection}
                        onClick={() =>
                          changeSort("quantity")
                        }
                      />
                      <th className="w-[46%] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                        Card
                      </th>
                      <TableHeading
                        label="Type"
                        className="hidden w-[22%] 2xl:table-cell"
                        active={
                          sortKey === "type"
                        }
                        direction={sortDirection}
                        onClick={() =>
                          changeSort("type")
                        }
                      />
                      <TableHeading
                        label="MV"
                        className="w-14"
                        active={
                          sortKey === "mana"
                        }
                        direction={sortDirection}
                        onClick={() =>
                          changeSort("mana")
                        }
                      />
                      <TableHeading
                        label="Price"
                        className="w-24"
                        active={
                          sortKey === "price"
                        }
                        direction={sortDirection}
                        onClick={() =>
                          changeSort("price")
                        }
                      />
                      <th className="w-28 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCards.map((card) => (
                      <DeckTableRow
                        key={card.id}
                        card={card}
                        checked={selectedIds.includes(
                          card.id,
                        )}
                        selected={
                          selectedCard?.id ===
                          card.id
                        }
                        onCheck={() =>
                          toggleSelected(card.id)
                        }
                        onSelect={() =>
                          setSelectedCardId(
                            card.id,
                          )
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {view === "grid" ? (
            <section className="rounded-[24px] border border-white/[0.07] bg-[#06131f] p-5">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-4">
                {filteredCards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() =>
                      setSelectedCardId(card.id)
                    }
                    className="cursor-pointer"
                  >
                    <DeckCardTile
                      card={card}
                      removeCard={removeCard}
                      format={format}
                      copyLimit={copyLimit}
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {view === "columns" ? (
            <DeckColumnsView
              cards={filteredCards}
              onSelect={setSelectedCardId}
            />
          ) : null}

          {view === "stacks" ? (
            <DeckStacksView
              cards={filteredCards}
              onSelect={setSelectedCardId}
            />
          ) : null}

          {view === "role" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {roleGroups.map((group) => (
                <section
                  key={group.role}
                  className="rounded-[22px] border border-white/[0.065] bg-[#06131f] p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[16px] font-semibold text-white">
                        {group.role}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {group.cards.reduce(
                          (sum, card) =>
                            sum + card.quantity,
                          0,
                        )}{" "}
                        cards
                      </p>
                    </div>
                    <span className="rounded-full border border-cyan-300/[0.1] bg-cyan-400/[0.03] px-2.5 py-1 text-[11px] text-cyan-200">
                      {group.cards.length} unique
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {group.cards.map((card) => (
                      <RoleCardPreview
                        key={card.id}
                        card={card}
                        onSelect={() =>
                          setSelectedCardId(
                            card.id,
                          )
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {view === "stats" ? (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {summaryByType.map((entry) => (
                <div
                  key={entry.type}
                  className="rounded-[22px] border border-white/[0.065] bg-[#06131f] p-5"
                >
                  <p className="text-[12px] font-semibold uppercase tracking-[0.11em] text-cyan-300">
                    {entry.type}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-white">
                    {entry.copies}
                  </p>
                  <p className="mt-2 text-[12px] text-slate-500">
                    {entry.unique} unique cards
                  </p>
                  <p className="mt-4 text-[14px] font-semibold text-emerald-200">
                    ${entry.value.toFixed(2)}
                  </p>
                </div>
              ))}
            </section>
          ) : null}
        </main>

        <aside className="xl:sticky xl:top-[190px] xl:self-start">
          <section className="overflow-hidden rounded-[24px] border border-cyan-300/[0.1] bg-[#06131f]">
            {selectedCard ? (
              <>
                <div className="relative aspect-[1.55] overflow-hidden">
                  <img
                    src={
                      selectedCard.artCrop ||
                      selectedCard.image
                    }
                    alt=""
                    className="h-full w-full object-cover opacity-75"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#06131f] via-[#06131f]/25 to-transparent" />
                </div>
                <div className="-mt-8 relative p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300">
                    Card Inspector
                  </p>
                  <h3 className="mt-2 text-[18px] font-semibold leading-6 text-white">
                    {selectedCard.name}
                  </h3>
                  <p className="mt-2 text-[12px] leading-5 text-slate-500">
                    {selectedCard.typeLine}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <InspectorMetric
                      label="Quantity"
                      value={`${selectedCard.quantity}`}
                    />
                    <InspectorMetric
                      label="Mana Value"
                      value={`${selectedCard.manaValue}`}
                    />
                    <InspectorMetric
                      label="Price"
                      value={`$${selectedCard.price.toFixed(2)}`}
                    />
                    <InspectorMetric
                      label="Owned"
                      value={`${Math.min(
                        selectedCard.quantity,
                        selectedCard.ownedQuantity ??
                          (selectedCard.owned
                            ? selectedCard.quantity
                            : 0),
                      )} / ${selectedCard.quantity}`}
                    />
                  </div>

                  <OwnershipLocations card={selectedCard} />

                  <div className="mt-5 space-y-2">
                    {isCommander ? <InspectorAction
                      href={edhrecCardUrl(
                        selectedCard.name,
                      )}
                      tone="cyan"
                    >
                      Analyze on EDHREC
                    </InspectorAction> : null}
                    <InspectorAction
                      tone="violet"
                    >
                      Find Replacement
                    </InspectorAction>
                    <InspectorAction
                      tone="rose"
                      onClick={() =>
                        removeCard(
                          selectedCard.id,
                        )
                      }
                    >
                      Remove from Deck
                    </InspectorAction>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-6 text-center">
                <Eye className="mx-auto h-6 w-6 text-slate-700" />
                <p className="mt-3 text-[13px] text-slate-500">
                  Select a card to inspect it.
                </p>
              </div>
            )}
          </section>

          <section className="mt-4 rounded-[22px] border border-white/[0.065] bg-[#06131f] p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.11em] text-slate-500">
              Live Deck Health
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <InspectorMetric
                label="Owned"
                value={`${owned}`}
              />
              <InspectorMetric
                label="Missing"
                value={`${missing}`}
              />
              <InspectorMetric
                label="Copy Rule"
                value={
                  singletonFormat
                    ? "Singleton"
                    : "Max 4"
                }
              />
              <InspectorMetric
                label="Value"
                value={`$${mainDeckValue.toFixed(0)}`}
              />
            </div>
          </section>
        </aside>
      </div>

      {showcaseOpen ? (
        <DeckShowcaseStudio
          deckName={deckName}
          commanderName={commanderName}
          format={format}
          cards={cards}
          marketValue={mainDeckValue}
          onClose={() => setShowcaseOpen(false)}
        />
      ) : null}
    </section>
  );
}

const deckTypeOrder = [
  "Commander",
  "Creature",
  "Planeswalker",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Battle",
  "Land",
  "Other",
];

function deckCardGroup(card: DeckCard) {
  if (card.board === "commander" || card.category === "Commander") return "Commander";
  return (
    deckTypeOrder.find((type) =>
      card.typeLine.toLowerCase().includes(type.toLowerCase()),
    ) ?? "Other"
  );
}

function groupedDeckCards(cards: DeckCard[]) {
  const groups = new Map<string, DeckCard[]>();
  cards.forEach((card) => {
    const type = deckCardGroup(card);
    groups.set(type, [...(groups.get(type) ?? []), card]);
  });
  return deckTypeOrder
    .filter((type) => groups.has(type))
    .map((type) => ({ type, cards: groups.get(type) ?? [] }));
}

function DeckColumnsView({
  cards,
  onSelect,
}: {
  cards: DeckCard[];
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-[24px] border border-white/[0.07] bg-[#06131f] p-5">
      <div className="columns-1 gap-4 md:columns-2 2xl:columns-3">
        {groupedDeckCards(cards).map((group) => (
          <section
            key={group.type}
            className="mb-4 inline-block w-full break-inside-avoid overflow-hidden rounded-2xl border border-white/[0.065] bg-[#081824]"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-cyan-200">
                {group.type}
              </p>
              <span className="text-[11px] text-slate-500">
                {group.cards.reduce((total, card) => total + card.quantity, 0)}
              </span>
            </div>
            <div className="py-1.5">
              {group.cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onSelect(card.id)}
                  className="group flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-cyan-300/[0.045]"
                >
                  <span className="w-5 text-[11px] font-bold text-slate-600">
                    {card.quantity}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-300 group-hover:text-cyan-100">
                    {card.name}
                  </span>
                  <ManaSymbols colors={card.colors} size="sm" />
                  <span className="text-[10px] text-slate-600">
                    ${card.price.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function DeckStacksView({
  cards,
  onSelect,
}: {
  cards: DeckCard[];
  onSelect: (id: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-cyan-300/[0.09] bg-[radial-gradient(circle_at_top,#0c2635_0,#06131f_42%,#030b12_100%)] p-5">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-[17px] font-semibold text-white">Tabletop Stacks</p>
          <p className="mt-1 text-[12px] text-slate-500">
            A physical, artwork-forward view of the complete deck.
          </p>
        </div>
        <span className="rounded-full border border-cyan-300/10 bg-cyan-300/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
          Trading Docks display
        </span>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
        {groupedDeckCards(cards).map((group) => (
          <section key={group.type} className="min-w-0">
            <div className="mb-3 flex items-center justify-between border-b border-white/[0.07] pb-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-300">
                {group.type}
              </p>
              <span className="text-[10px] text-slate-600">
                {group.cards.reduce((total, card) => total + card.quantity, 0)}
              </span>
            </div>
            <div className="space-y-[-1px]">
              {group.cards.map((card, index) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onSelect(card.id)}
                  className="group relative block w-full text-left transition hover:z-20 hover:-translate-y-2"
                  style={{ zIndex: group.cards.length - index }}
                >
                  <div className="relative aspect-[1.9] overflow-hidden rounded-xl border border-white/10 bg-[#071824] shadow-[0_-8px_18px_rgba(0,0,0,0.3)]">
                    <img
                      src={
                        card.artCrop ||
                        card.image ||
                        `/api/deck-vault/card-image?name=${encodeURIComponent(card.name)}`
                      }
                      alt=""
                      className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-white">{card.name}</p>
                        <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-slate-400">
                          {card.setCode || group.type}
                        </p>
                      </div>
                      {card.quantity > 1 ? (
                        <span className="ml-2 rounded-full bg-cyan-300 px-2 py-1 text-[10px] font-black text-[#00131d]">
                          ×{card.quantity}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

type ShowcaseTheme = "harbor" | "midnight" | "color" | "black";
type ShowcaseSize = "portrait" | "square" | "story";

const SHOWCASE_LAYOUT: Record<
  ShowcaseSize,
  { columns: number; canvasGap: number; previewGap: string }
> = {
  square: { columns: 7, canvasGap: 8, previewGap: "0.3rem" },
  portrait: { columns: 5, canvasGap: 9, previewGap: "0.35rem" },
  story: { columns: 4, canvasGap: 10, previewGap: "0.4rem" },
};

const SHOWCASE_CATEGORY_ORDER = [
  "Commander", "Planeswalker", "Creature", "Artifact", "Enchantment",
  "Instant", "Sorcery", "Battle", "Land", "Sideboard", "Considering",
];

function showcaseCategory(card: DeckCard) {
  if (card.board === "commander" || card.category === "Commander") return "Commander";
  if (card.board === "sideboard") return "Sideboard";
  if (card.board === "maybeboard") return "Considering";
  const type = card.typeLine.toLowerCase();
  for (const category of SHOWCASE_CATEGORY_ORDER.slice(1, 9)) {
    if (type.includes(category.toLowerCase())) return category;
  }
  return card.category || "Other";
}

function buildShowcaseGroups(cards: DeckCard[]) {
  const groups = new Map<string, DeckCard[]>();
  cards.forEach((card) => {
    const category = showcaseCategory(card);
    groups.set(category, [...(groups.get(category) ?? []), card]);
  });
  return [...groups.entries()]
    .sort(([left], [right]) => {
      const leftIndex = SHOWCASE_CATEGORY_ORDER.indexOf(left);
      const rightIndex = SHOWCASE_CATEGORY_ORDER.indexOf(right);
      return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex);
    })
    .map(([category, groupCards]) => ({
      category,
      cards: groupCards.sort((a, b) => a.manaValue - b.manaValue || a.name.localeCompare(b.name)),
      count: groupCards.reduce((total, card) => total + card.quantity, 0),
    }));
}

function showcaseCardCopies(cards: DeckCard[]) {
  return cards.flatMap((card) =>
    Array.from({ length: Math.max(1, card.quantity) }, (_, copyIndex) => ({
      card,
      copyIndex,
    })),
  );
}

function buildShowcaseStats(cards: DeckCard[]) {
  const mainCards = cards.filter(
    (card) => card.board !== "sideboard" && card.board !== "maybeboard",
  );
  const nonLandCards = mainCards.filter(
    (card) => !card.typeLine.toLowerCase().includes("land"),
  );
  const nonLandCount = nonLandCards.reduce(
    (total, card) => total + card.quantity,
    0,
  );
  const averageManaValue = nonLandCount
    ? nonLandCards.reduce(
        (total, card) => total + card.manaValue * card.quantity,
        0,
      ) / nonLandCount
    : 0;
  const typeCounts = {
    creatures: mainCards
      .filter((card) => card.typeLine.toLowerCase().includes("creature"))
      .reduce((total, card) => total + card.quantity, 0),
    spells: mainCards
      .filter((card) => {
        const type = card.typeLine.toLowerCase();
        return type.includes("instant") || type.includes("sorcery");
      })
      .reduce((total, card) => total + card.quantity, 0),
    lands: mainCards
      .filter((card) => card.typeLine.toLowerCase().includes("land"))
      .reduce((total, card) => total + card.quantity, 0),
  };
  const colorCounts = (["W", "U", "B", "R", "G"] as ManaColor[]).map(
    (color) => ({
      color,
      count: mainCards
        .filter((card) => card.colors.includes(color))
        .reduce((total, card) => total + card.quantity, 0),
    }),
  );
  const manaCurve = Array.from({ length: 8 }, (_, index) =>
    nonLandCards
      .filter((card) =>
        index === 7
          ? card.manaValue >= 7
          : Math.floor(card.manaValue) === index,
      )
      .reduce((total, card) => total + card.quantity, 0),
  );
  return { averageManaValue, typeCounts, colorCounts, manaCurve };
}

const SHOWCASE_COLOR_PALETTE: Record<ManaColor, { bright: string; deep: string }> = {
  W: { bright: "#f5e6b3", deep: "#766b42" },
  U: { bright: "#38a8e8", deep: "#124b73" },
  B: { bright: "#9b89ad", deep: "#35283e" },
  R: { bright: "#ef6351", deep: "#782b25" },
  G: { bright: "#43c985", deep: "#175c3d" },
  C: { bright: "#cbd5e1", deep: "#334155" },
};

function buildDeckIdentityColors(cards: DeckCard[]) {
  const present = new Set<ManaColor>();
  cards.forEach((card) => {
    card.colors.forEach((color) => {
      if (color in SHOWCASE_COLOR_PALETTE) present.add(color);
    });
  });
  return (["W", "U", "B", "R", "G"] as ManaColor[]).filter((color) =>
    present.has(color),
  );
}

function deckIdentityGradient(colors: ManaColor[]) {
  if (!colors.length) {
    return "linear-gradient(135deg,#334155 0%,#111827 46%,#020617 100%)";
  }
  const stops = colors
    .map((color, index) => {
      const position =
        colors.length === 1 ? 0 : Math.round((index / (colors.length - 1)) * 100);
      return `${SHOWCASE_COLOR_PALETTE[color].deep} ${position}%`;
    })
    .join(",");
  return `linear-gradient(135deg,${stops},#020609 100%)`;
}

function DeckShowcaseStudio({
  deckName,
  commanderName,
  format,
  cards,
  marketValue,
  onClose,
}: {
  deckName: string;
  commanderName: string;
  format: DeckFormat;
  cards: DeckCard[];
  marketValue: number;
  onClose: () => void;
}) {
  const [theme, setTheme] = useState<ShowcaseTheme>("harbor");
  const [size, setSize] = useState<ShowcaseSize>("portrait");
  const [showValue, setShowValue] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showLink, setShowLink] = useState(true);
  const [exporting, setExporting] = useState(false);
  const groups = buildShowcaseGroups(cards);
  const cardCount = cards.reduce((total, card) => total + card.quantity, 0);
  const stats = buildShowcaseStats(cards);
  const identityColors = buildDeckIdentityColors(cards);
  const identityAccent =
    identityColors.length > 1
      ? SHOWCASE_COLOR_PALETTE[identityColors[1]].bright
      : identityColors.length
        ? SHOWCASE_COLOR_PALETTE[identityColors[0]].bright
        : "#cbd5e1";
  const publicUrl =
    typeof window === "undefined" ? "tradingdocks.com/decks" : window.location.href;
  const showcaseFont =
    'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

  async function loadCanvasImage(src: string) {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  async function loadBrandImage(kind: "horizontal" | "mark") {
    const candidates =
      kind === "horizontal"
        ? ["/trading-docks-horizontal.png", "/brand/trading-docks-horizontal.png"]
        : ["/trading-docks-mark.png", "/brand/trading-docks-mark.png"];
    for (const source of candidates) {
      try {
        return await loadCanvasImage(source);
      } catch {
        // Try the next bundled brand asset.
      }
    }
    return null;
  }

  async function exportShowcase() {
    setExporting(true);
    try {
      const dimensions = {
        portrait: [1080, 1350],
        square: [1080, 1080],
        story: [1080, 1920],
      }[size];
      const canvas = document.createElement("canvas");
      canvas.width = dimensions[0];
      canvas.height = dimensions[1];
      const context = canvas.getContext("2d");
      if (!context) return;

      const palettes = {
        harbor: ["#031019", "#082c3b", "#19d3e6"],
        midnight: ["#050713", "#151b35", "#8b5cf6"],
        color: ["#05080b", "#111827", identityAccent],
        black: ["#000000", "#000000", "#67e8f9"],
      };
      const [dark, mid, accent] = palettes[theme];
      const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      if (theme === "black") {
        gradient.addColorStop(0, "#000000");
        gradient.addColorStop(1, "#000000");
      } else if (theme === "color" && identityColors.length) {
        identityColors.forEach((color, index) => {
          gradient.addColorStop(
            identityColors.length === 1
              ? 0
              : (index / Math.max(1, identityColors.length - 1)) * 0.72,
            SHOWCASE_COLOR_PALETTE[color].deep,
          );
        });
      } else {
        gradient.addColorStop(0, mid);
        gradient.addColorStop(0.42, dark);
      }
      gradient.addColorStop(1, "#010509");
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);

      if (theme !== "black") {
        context.globalAlpha = 0.12;
        context.strokeStyle = accent;
        context.lineWidth = 2;
        for (let x = -canvas.height; x < canvas.width; x += 86) {
          context.beginPath();
          context.moveTo(x, 0);
          context.lineTo(x + canvas.height, canvas.height);
          context.stroke();
        }
        context.globalAlpha = 1;
      }

      const brandMark = await loadBrandImage("mark");
      const brandWordmark = await loadBrandImage("horizontal");
      context.fillStyle = "rgba(1,8,14,.9)";
      roundedRect(context, 24, 14, 304, 72, 12);
      context.fill();
      context.strokeStyle = "rgba(103,232,249,.28)";
      context.lineWidth = 1;
      roundedRect(context, 24, 14, 304, 72, 12);
      context.stroke();
      if (brandMark) {
        context.drawImage(brandMark, 33, 20, 60, 60);
      } else {
        context.fillStyle = accent;
        context.fillRect(38, 26, 7, 48);
      }
      if (brandWordmark) {
        context.drawImage(brandWordmark, 99, 23, 214, 58);
      } else {
        context.fillStyle = "#ffffff";
        context.font = `900 19px ${showcaseFont}`;
        context.fillText("TRADING DOCKS", 105, 56);
      }
      context.fillStyle = "#ffffff";
      context.font = `800 48px ${showcaseFont}`;
      wrapCanvasText(context, deckName || "Untitled Deck", 32, 126, 998, 54, 2);
      context.fillStyle = "#94a3b8";
      context.font = `600 17px ${showcaseFont}`;
      context.fillText(
        `${format}${commanderName ? `  •  COMMANDER: ${commanderName}` : ""}`,
        32,
        166,
      );
      context.fillStyle = "#ffffff";
      context.font = `800 18px ${showcaseFont}`;
      context.fillText(
        `${cardCount} CARDS${showValue ? `  •  DECK VALUE $${marketValue.toFixed(2)}` : ""}`,
        32,
        193,
      );

      let posterTop = 226;
      if (showStats) {
        const statTop = 214;
        context.fillStyle = "rgba(255,255,255,.075)";
        roundedRect(context, 32, statTop, canvas.width - 64, 68, 10);
        context.fill();

        context.font = `800 12px ${showcaseFont}`;
        context.fillStyle = "#94a3b8";
        context.fillText(`AVG MV`, 50, statTop + 21);
        context.fillText(`CREATURES`, 139, statTop + 21);
        context.fillText(`SPELLS`, 256, statTop + 21);
        context.fillText(`LANDS`, 348, statTop + 21);
        context.font = `900 19px ${showcaseFont}`;
        context.fillStyle = "#ffffff";
        context.fillText(stats.averageManaValue.toFixed(2), 50, statTop + 49);
        context.fillText(String(stats.typeCounts.creatures), 139, statTop + 49);
        context.fillText(String(stats.typeCounts.spells), 256, statTop + 49);
        context.fillText(String(stats.typeCounts.lands), 348, statTop + 49);

        const colorFills: Record<string, string> = {
          W: "#f5e8b6",
          U: "#38a8e8",
          B: "#8b7b9d",
          R: "#ef6351",
          G: "#43c985",
        };
        stats.colorCounts.forEach((entry, index) => {
          const x = 449 + index * 45;
          context.fillStyle = colorFills[entry.color];
          context.beginPath();
          context.arc(x, statTop + 25, 12, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#06131f";
          context.font = `900 12px ${showcaseFont}`;
          context.textAlign = "center";
          context.fillText(entry.color, x, statTop + 29);
          context.fillStyle = "#cbd5e1";
          context.font = `800 12px ${showcaseFont}`;
          context.fillText(String(entry.count), x, statTop + 53);
        });
        context.textAlign = "left";

        const curveLeft = 720;
        const curveBottom = statTop + 52;
        const curveMax = Math.max(1, ...stats.manaCurve);
        stats.manaCurve.forEach((count, index) => {
          const height = Math.max(3, (count / curveMax) * 30);
          const x = curveLeft + index * 38;
          context.fillStyle = accent;
          context.fillRect(x, curveBottom - height, 27, height);
          context.fillStyle = "#94a3b8";
          context.font = `700 10px ${showcaseFont}`;
          context.textAlign = "center";
          context.fillText(index === 7 ? "7+" : String(index), x + 13, statTop + 65);
        });
        context.textAlign = "left";
        posterTop = 308;
      }
      const posterBottom = canvas.height - 92;
      const posterHeight = posterBottom - posterTop;
      const posterLeft = 24;
      const posterWidth = canvas.width - posterLeft * 2;
      const columnCount = Math.min(
        SHOWCASE_LAYOUT[size].columns,
        Math.max(1, groups.length),
      );
      const rowCount = Math.ceil(groups.length / columnCount);
      const columnGap = SHOWCASE_LAYOUT[size].canvasGap;
      const rowGap = SHOWCASE_LAYOUT[size].canvasGap;
      const columnWidth =
        (posterWidth - columnGap * Math.max(0, columnCount - 1)) / columnCount;
      const rowHeight =
        (posterHeight - rowGap * Math.max(0, rowCount - 1)) / Math.max(1, rowCount);
      const loadedImages = new Map<string, HTMLImageElement>();
      await Promise.all(
        cards.map(async (card) => {
          try {
            const image = await loadCanvasImage(
              card.image || `/api/deck-vault/card-image?name=${encodeURIComponent(card.name)}`,
            );
            loadedImages.set(card.id, image);
          } catch {
            // Keep exporting the complete deck when an individual image is unavailable.
          }
        }),
      );

      groups.forEach((group, groupIndex) => {
        const columnIndex = groupIndex % columnCount;
        const rowIndex = Math.floor(groupIndex / columnCount);
        const groupsInRow = Math.min(
          columnCount,
          groups.length - rowIndex * columnCount,
        );
        const rowContentWidth =
          groupsInRow * columnWidth + Math.max(0, groupsInRow - 1) * columnGap;
        const rowLeft = posterLeft + (posterWidth - rowContentWidth) / 2;
        const x = rowLeft + columnIndex * (columnWidth + columnGap);
        const groupTop = posterTop + rowIndex * (rowHeight + rowGap);
        const moduleInset = 2;
        context.fillStyle = "rgba(1,8,14,.9)";
        roundedRect(context, x, groupTop, columnWidth, 26, 5);
        context.fill();
        context.fillStyle = "#ffffff";
        context.font = `800 12px ${showcaseFont}`;
        context.fillText(
          `${group.category.toUpperCase()}  ${group.count}`,
          x + 6,
          groupTop + 18,
        );
        const cardsTop = groupTop + 30;
        const availableStackHeight = rowHeight - 30;
        const displayCards = showcaseCardCopies(group.cards);
        const maximumCardHeight =
          displayCards.length <= 1
            ? availableStackHeight
            : Math.max(44, availableStackHeight * 0.64);
        const moduleCardWidth = Math.min(
          columnWidth - moduleInset * 2,
          maximumCardHeight / 1.395,
        );
        const moduleCardHeight = moduleCardWidth * 1.395;
        const moduleCardX = x + (columnWidth - moduleCardWidth) / 2;
        const overlap =
          displayCards.length <= 1
            ? 0
            : Math.max(1, (availableStackHeight - moduleCardHeight) /
                (displayCards.length - 1));

        displayCards.forEach(({ card }, cardIndex) => {
          const y = cardsTop + cardIndex * overlap;
          const image = loadedImages.get(card.id);
          if (image) {
            drawRoundedImage(
              context,
              image,
              moduleCardX,
              y,
              moduleCardWidth,
              moduleCardHeight,
              7,
            );
          } else {
            context.fillStyle = "#102331";
            roundedRect(
              context,
              moduleCardX,
              y,
              moduleCardWidth,
              moduleCardHeight,
              7,
            );
            context.fill();
            context.fillStyle = "#ffffff";
            context.font = `700 ${Math.max(10, moduleCardWidth * 0.09)}px ${showcaseFont}`;
            wrapCanvasText(
              context,
              card.name,
              moduleCardX + 7,
              y + 24,
              moduleCardWidth - 14,
              14,
              3,
            );
          }
          context.strokeStyle = "rgba(255,255,255,.24)";
          context.lineWidth = 1;
          roundedRect(
            context,
            moduleCardX,
            y,
            moduleCardWidth,
            moduleCardHeight,
            7,
          );
          context.stroke();

        });
      });

      const footerY = canvas.height - 65;
      context.fillStyle = "rgba(255,255,255,.08)";
      context.fillRect(32, footerY - 22, canvas.width - 64, 1);
      context.fillStyle = "#ffffff";
      context.font = `800 15px ${showcaseFont}`;
      context.fillText("BUILT IN THE DECK VAULT", 32, footerY + 8);
      if (brandWordmark) {
        const logoWidth = 188;
        const logoHeight = 62;
        context.drawImage(
          brandWordmark,
          canvas.width - logoWidth - 28,
          footerY - 34,
          logoWidth,
          logoHeight,
        );
      } else {
        context.font = `800 16px ${showcaseFont}`;
        context.fillText("TRADING DOCKS", canvas.width - 190, footerY + 8);
      }
      context.fillStyle = accent;
      context.font = `600 13px ${showcaseFont}`;
      context.fillText(
        showLink ? publicUrl.replace(/^https?:\/\//, "").slice(0, 82) : "TRADINGDOCKS.COM",
        32,
        footerY + 31,
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 1),
      );
      if (!blob) return;
      const fileName = `${(deckName || "trading-docks-deck")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-showcase.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${deckName} — Trading Docks Deck Vault`,
          text: `Check out my ${format} deck built in Trading Docks.`,
          files: [file],
        });
      } else {
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(href);
      }
    } finally {
      setExporting(false);
    }
  }

  const previewGradient = {
    harbor: "from-[#0b3444] via-[#04141f] to-[#02070b]",
    midnight: "from-[#1a2040] via-[#080a18] to-[#03040a]",
    color: "",
    black: "from-black via-black to-black",
  }[theme];
  const previewBackground =
    theme === "color" ? deckIdentityGradient(identityColors) : undefined;
  const previewColumnCount = Math.min(
    SHOWCASE_LAYOUT[size].columns,
    Math.max(1, groups.length),
  );

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#01070c]/92 p-4 backdrop-blur-xl">
      <div className="mx-auto flex min-h-full max-w-[1480px] items-center justify-center">
        <section className="w-full overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[#06131f] shadow-[0_30px_120px_rgba(0,0,0,.65)]">
          <header className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
            <div className="flex items-center gap-4">
              <img
                src="/trading-docks-horizontal.png"
                onError={(event) => {
                  event.currentTarget.src = "/brand/trading-docks-horizontal.png";
                }}
                alt="Trading Docks"
                className="hidden h-10 w-auto max-w-[150px] object-contain sm:block"
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
                  Showcase Studio
                </p>
              <h2 className="mt-1 text-xl font-semibold text-white">Turn your deck into a shareable poster</h2>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl border border-white/10 p-2.5 text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="grid lg:grid-cols-[330px_minmax(0,1fr)]">
            <aside className="border-b border-white/[0.07] p-5 lg:border-b-0 lg:border-r">
              <ShowcaseControl title="Social size">
                {([
                  ["portrait", "Instagram 4:5"],
                  ["square", "Square 1:1"],
                  ["story", "Story 9:16"],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setSize(value)} className={`rounded-xl border px-3 py-2 text-[11px] font-semibold ${size === value ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/[0.07] text-slate-500"}`}>
                    {label}
                  </button>
                ))}
              </ShowcaseControl>
              <ShowcaseControl title="Visual theme">
                {([
                  ["harbor", "Harbor Cyan"],
                  ["midnight", "Midnight Foil"],
                  ["color", "Color Identity"],
                  ["black", "Pure Black"],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setTheme(value)} className={`rounded-xl border px-3 py-2 text-[11px] font-semibold ${theme === value ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "border-white/[0.07] text-slate-500"}`}>
                    {label}
                  </button>
                ))}
              </ShowcaseControl>
              <ShowcaseControl title="Include">
                <ShowcaseToggle label="Deck value" checked={showValue} onChange={setShowValue} />
                <ShowcaseToggle label="Deck stats" checked={showStats} onChange={setShowStats} />
                <ShowcaseToggle label="Public deck link" checked={showLink} onChange={setShowLink} />
              </ShowcaseControl>
              <div className="mt-7 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.035] p-4">
                <p className="text-[11px] font-semibold text-cyan-100">Full-deck poster</p>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  Every card is included. Duplicate copies are combined into physical-style stacks, and every export carries the Trading Docks signature.
                </p>
              </div>
              <button type="button" onClick={() => void exportShowcase()} disabled={exporting} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-400 text-[12px] font-black text-[#00121c] disabled:opacity-60">
                <Download className="h-4 w-4" />
                {exporting ? "Building your graphic…" : "Download or Share PNG"}
              </button>
            </aside>
            <main className="flex min-h-[720px] items-center justify-center overflow-hidden bg-[#02090e] p-3 sm:p-5">
              <div
                className={`relative w-full max-w-[760px] overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br ${previewGradient} p-4 shadow-[0_24px_80px_rgba(0,0,0,.55)] sm:p-5 ${size === "square" ? "aspect-square" : size === "story" ? "aspect-[9/16] max-w-[430px]" : "aspect-[4/5]"}`}
                style={previewBackground ? { backgroundImage: previewBackground } : undefined}
              >
                {theme !== "black" ? (
                  <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "repeating-linear-gradient(135deg,transparent 0,transparent 32px,#67e8f9 33px,#67e8f9 34px)" }} />
                ) : null}
                <div className="relative flex h-full flex-col font-sans">
                  <div className="flex min-h-10 items-center">
                    <div className="flex h-10 items-center gap-2 rounded-lg border border-cyan-300/20 bg-[#01080e]/85 px-2.5 shadow-[0_6px_24px_rgba(0,0,0,.35)]">
                      <img
                        src="/trading-docks-mark.png"
                        onError={(event) => {
                          event.currentTarget.src = "/brand/trading-docks-mark.png";
                        }}
                        alt=""
                        className="h-8 w-8 shrink-0 object-contain"
                      />
                    <img
                      src="/trading-docks-horizontal.png"
                      onError={(event) => {
                        event.currentTarget.src = "/brand/trading-docks-horizontal.png";
                      }}
                      alt="Trading Docks"
                      className="h-8 w-auto max-w-[145px] object-contain object-left"
                    />
                    </div>
                  </div>
                  <h3 className="mt-1 text-[clamp(20px,3.5vw,34px)] font-black leading-[1.02] text-white">{deckName}</h3>
                  <p className="mt-1 truncate text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {format}{commanderName ? ` · Commander: ${commanderName}` : ""}
                  </p>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-white">
                    {cardCount} cards {showValue ? `· Deck value $${marketValue.toFixed(2)}` : ""}
                  </p>
                  {showStats ? (
                    <div className="mt-2 grid grid-cols-[repeat(4,minmax(0,1fr))_1.8fr] gap-1 rounded-lg border border-white/[0.07] bg-white/[0.045] px-2 py-1.5">
                      {[
                        ["Avg MV", stats.averageManaValue.toFixed(2)],
                        ["Creatures", stats.typeCounts.creatures],
                        ["Spells", stats.typeCounts.spells],
                        ["Lands", stats.typeCounts.lands],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="truncate text-[5px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
                          <p className="mt-0.5 text-[8px] font-black text-white">{value}</p>
                        </div>
                      ))}
                      <div className="flex items-end gap-[2px]">
                        {stats.manaCurve.map((count, index) => (
                          <div key={index} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                            <div className="w-full rounded-t-[1px] bg-cyan-300" style={{ height: `${Math.max(2, (count / Math.max(1, ...stats.manaCurve)) * 17)}px` }} />
                            <span className="mt-0.5 text-[4px] text-slate-500">{index === 7 ? "7+" : index}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div
                    className={`${showStats ? "mt-2" : "mt-3"} grid min-h-0 flex-1 overflow-hidden`}
                    style={{
                      gridTemplateColumns: `repeat(${previewColumnCount}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${Math.ceil(groups.length / previewColumnCount)}, minmax(0, 1fr))`,
                      gap: SHOWCASE_LAYOUT[size].previewGap,
                    }}
                  >
                    {groups.map((group, groupIndex) => {
                      const displayCards = showcaseCardCopies(group.cards);
                      const overlapPercent =
                        displayCards.length <= 1
                          ? 0
                          : Math.min(14, 62 / Math.max(1, displayCards.length - 1));
                      const rowIndex = Math.floor(groupIndex / previewColumnCount);
                      const groupsInRow = Math.min(
                        previewColumnCount,
                        groups.length - rowIndex * previewColumnCount,
                      );
                      const isPartialRow = groupsInRow < previewColumnCount;
                      const firstColumnInRow = groupIndex % previewColumnCount === 0;
                      return (
                        <div
                          key={group.category}
                          className="min-w-0 overflow-hidden"
                          style={
                            isPartialRow && firstColumnInRow
                              ? {
                                  gridColumnStart:
                                    Math.floor((previewColumnCount - groupsInRow) / 2) + 1,
                                }
                              : undefined
                          }
                        >
                          <p className="mb-1 truncate rounded-[3px] bg-black/80 px-1 py-0.5 text-[6px] font-black uppercase tracking-[0.06em] text-white">
                            {group.category} {group.count}
                          </p>
                          <div className="relative h-[calc(100%-12px)] overflow-hidden">
                            {displayCards.map(({ card, copyIndex }, index) => (
                              <div
                                key={`${card.id}-${copyIndex}`}
                                className="absolute inset-x-0 mx-auto aspect-[63/88] w-full overflow-hidden rounded-[3px]"
                                style={{ top: `${index * overlapPercent}%` }}
                              >
                                <img
                                  src={card.image || `/api/deck-vault/card-image?name=${encodeURIComponent(card.name)}`}
                                  alt={card.name}
                                  className="h-full w-full rounded-[3px] border border-white/20 object-cover shadow-md"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 border-t border-white/10 pt-2">
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[7px] font-black uppercase tracking-[0.13em] text-white">Built in the Deck Vault</p>
                        <p className="mt-0.5 truncate text-[6px] font-semibold text-cyan-300">{showLink ? publicUrl.replace(/^https?:\/\//, "") : "tradingdocks.com"}</p>
                      </div>
                      <img
                        src="/trading-docks-horizontal.png"
                        onError={(event) => {
                          event.currentTarget.src = "/brand/trading-docks-horizontal.png";
                        }}
                        alt="Trading Docks"
                        className="h-8 w-auto max-w-[130px] object-contain object-right"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </section>
      </div>
    </div>
  );
}

function ShowcaseControl({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ShowcaseToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/[0.07] px-3 py-2.5 text-[11px] text-slate-300">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawRoundedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.save();
  roundedRect(context, x, y, width, height, radius);
  context.clip();
  context.drawImage(image, x, y, width, height);
  context.restore();
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(" ");
  let line = "";
  let lineNumber = 0;
  for (const word of words) {
    const test = `${line}${word} `;
    if (context.measureText(test).width > maxWidth && line) {
      context.fillText(line.trim(), x, y + lineNumber * lineHeight);
      line = `${word} `;
      lineNumber += 1;
      if (lineNumber >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (lineNumber < maxLines) context.fillText(line.trim(), x, y + lineNumber * lineHeight);
}

function ExplorerRow({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition",
        active
          ? "border-cyan-300/[0.16] bg-cyan-400/[0.04] text-cyan-100"
          : "border-transparent text-slate-500 hover:border-white/[0.055] hover:bg-white/[0.015] hover:text-slate-300",
      ].join(" ")}
    >
      <span className="text-[12px] font-medium">
        {label}
      </span>
      <span className="text-[11px] font-semibold">
        {value}
      </span>
    </button>
  );
}

function TableHeading({
  label,
  active,
  direction,
  onClick,
  className = "",
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={`px-3 py-3 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className={[
          "text-[11px] font-semibold uppercase tracking-[0.1em]",
          active
            ? "text-cyan-200"
            : "text-slate-500",
        ].join(" ")}
      >
        {label}
        {active
          ? direction === "asc"
            ? " ↑"
            : " ↓"
          : ""}
      </button>
    </th>
  );
}

function DeckTableRow({
  card,
  checked,
  selected,
  onCheck,
  onSelect,
}: {
  card: DeckCard;
  checked: boolean;
  selected: boolean;
  onCheck: () => void;
  onSelect: () => void;
}) {
  const [previewOpen, setPreviewOpen] =
    useState(false);
  const [previewPosition, setPreviewPosition] =
    useState({
      top: 16,
      left: 16,
    });
  const [imageFailed, setImageFailed] =
    useState(false);

  const imageSource =
    card.image ||
    `/api/deck-vault/card-image?name=${encodeURIComponent(
      card.name,
    )}`;

  useEffect(() => {
    setImageFailed(false);
  }, [imageSource]);

  function openPreview(
    target: HTMLElement,
  ) {
    const rect =
      target.getBoundingClientRect();
    const previewWidth = 260;
    const previewHeight = 470;
    const viewportPadding = 16;

    let left = rect.right + 18;

    if (
      left + previewWidth >
      window.innerWidth - viewportPadding
    ) {
      left =
        rect.left -
        previewWidth -
        18;
    }

    left = Math.max(
      viewportPadding,
      Math.min(
        left,
        window.innerWidth -
          previewWidth -
          viewportPadding,
      ),
    );

    const preferredTop =
      rect.top -
      previewHeight * 0.32;

    const top = Math.max(
      viewportPadding,
      Math.min(
        preferredTop,
        window.innerHeight -
          previewHeight -
          viewportPadding,
      ),
    );

    setPreviewPosition({
      top,
      left,
    });
    setPreviewOpen(true);
  }

  return (
    <tr
      onClick={onSelect}
      className={[
        "cursor-pointer border-b border-white/[0.04] transition last:border-b-0",
        selected
          ? "bg-cyan-400/[0.045]"
          : "hover:bg-white/[0.018]",
      ].join(" ")}
    >
      <td
        className="px-3 py-2.5"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          aria-label={`Select ${card.name}`}
        />
      </td>

      <td className="px-3 py-2.5 text-[13px] font-semibold text-cyan-200">
        {card.quantity}
      </td>

      <td className="min-w-0 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md border border-white/[0.06] bg-slate-950">
            {!imageFailed ? (
              <img
                src={imageSource}
                alt={card.name}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() =>
                  setImageFailed(true)
                }
              />
            ) : null}
          </div>

          <div className="min-w-0">
            <button
              type="button"
              onMouseEnter={(event) =>
                openPreview(
                  event.currentTarget,
                )
              }
              onMouseLeave={() =>
                setPreviewOpen(false)
              }
              onFocus={(event) =>
                openPreview(
                  event.currentTarget,
                )
              }
              onBlur={() =>
                setPreviewOpen(false)
              }
              onClick={(event) => {
                event.stopPropagation();
                onSelect();
              }}
              className="group/name max-w-full text-left"
              aria-describedby={`preview-${card.id}`}
            >
              <p className="truncate text-[14px] font-semibold text-white underline decoration-transparent underline-offset-4 transition group-hover/name:text-cyan-200 group-hover/name:decoration-cyan-300/40">
                {card.name}
              </p>
              <p className="mt-1 truncate text-[11px] text-slate-500">
                {card.category} · {card.typeLine}
              </p>
            </button>

            {previewOpen ? (
              <div
                id={`preview-${card.id}`}
                role="tooltip"
                style={{
                  top: previewPosition.top,
                  left: previewPosition.left,
                }}
                className="pointer-events-none fixed z-[120] w-[260px] rounded-[22px] border border-cyan-300/[0.16] bg-[#04101a]/98 p-3 shadow-[0_28px_90px_rgba(0,0,0,0.62),0_0_34px_rgba(34,211,238,0.12)] backdrop-blur-xl"
              >
                <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/30">
                  {!imageFailed ? (
                    <img
                      src={imageSource}
                      alt={card.name}
                      className="aspect-[0.715] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[0.715] items-center justify-center p-5 text-center text-[12px] text-slate-500">
                      Card image unavailable
                    </div>
                  )}
                </div>

                <div className="px-1 pb-1 pt-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold leading-5 text-white">
                        {card.name}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-slate-500">
                        {card.typeLine}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg border border-cyan-300/[0.12] bg-cyan-400/[0.035] px-2 py-1 text-[11px] font-semibold text-cyan-200">
                      MV {card.manaValue}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-white/[0.055] pt-3">
                    <span className="text-[11px] text-slate-500">
                      {card.quantity === 1
                        ? "Single copy"
                        : `${card.quantity} copies`}
                    </span>
                    <span className="text-[13px] font-semibold text-emerald-200">
                      ${card.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </td>

      <td className="hidden truncate px-3 py-2.5 text-[12px] text-slate-400 2xl:table-cell">
        {card.typeLine}
      </td>

      <td className="px-3 py-2.5 text-[13px] text-slate-300">
        {card.manaValue}
      </td>

      <td className="px-3 py-2.5 text-[13px] font-semibold text-emerald-200">
        ${card.price.toFixed(2)}
      </td>

      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          {card.owned ? (
            <span className="rounded-full border border-emerald-300/[0.1] bg-emerald-400/[0.025] px-2 py-1 text-[10px] text-emerald-200">
              Owned {Math.min(card.quantity, card.ownedQuantity ?? card.quantity)}/{card.quantity}
            </span>
          ) : (card.ownedQuantity ?? 0) > 0 ? (
            <span className="rounded-full border border-amber-300/[0.12] bg-amber-400/[0.035] px-2 py-1 text-[10px] text-amber-100">
              Partial {Math.min(card.quantity, card.ownedQuantity ?? 0)}/{card.quantity}
            </span>
          ) : (
            <span className="rounded-full border border-amber-300/[0.1] bg-amber-400/[0.025] px-2 py-1 text-[10px] text-amber-200">
              Missing
            </span>
          )}

          {card.legalityStatus &&
          card.legalityStatus !== "legal" ? (
            <span
              title={card.legalityMessage}
              className="rounded-full border border-rose-300/30 bg-rose-500/15 px-2 py-1 text-[10px] font-semibold text-rose-100"
            >
              {card.legalityStatus === "banned"
                ? "Banned"
                : "Illegal"}
            </span>
          ) : null}
          {card.gameChanger ? (
            <span className="rounded-full border border-violet-300/[0.12] bg-violet-400/[0.035] px-2 py-1 text-[10px] text-violet-200">
              Game Changer
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function inventoryLocationLabel(match: InventoryMatch) {
  const details = [
    match.location,
    match.binderPage ? `Page ${match.binderPage}` : "",
    match.binderSlot ?? "",
  ].filter(Boolean);
  return details.join(" · ");
}

function OwnershipLocations({ card }: { card: DeckCard }) {
  const matches = card.inventoryMatches ?? [];
  const ownedQuantity = card.ownedQuantity ?? 0;

  return (
    <div className="mt-4 rounded-xl border border-white/[0.065] bg-black/[0.14] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          Collection locations
        </p>
        <span className="text-[10px] font-semibold text-cyan-200">
          {ownedQuantity} owned
        </span>
      </div>
      {matches.length ? (
        <div className="mt-2 space-y-2">
          {matches.map((match) => (
            <div
              key={match.inventoryId}
              className="flex items-start gap-2 rounded-lg border border-white/[0.05] bg-white/[0.018] px-2.5 py-2"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-200">
                  {inventoryLocationLabel(match)}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {match.quantity} {match.quantity === 1 ? "copy" : "copies"}
                  {match.condition ? ` · ${match.condition}` : ""}
                  {match.printing ? ` · ${match.printing}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[11px] leading-4 text-slate-600">
          No matching physical copy was found in a binder, bulk box, or other inventory location.
        </p>
      )}
    </div>
  );
}
function RoleCardPreview({
  card,
  onSelect,
}: {
  card: DeckCard;
  onSelect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const imageSource =
    card.image ||
    `/api/deck-vault/card-image?name=${encodeURIComponent(
      card.name,
    )}`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex w-full items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.012] p-2 text-left transition hover:border-cyan-300/[0.14] hover:bg-cyan-400/[0.025]"
      >
        <img
          src={imageSource}
          alt={card.name}
          className="h-14 w-10 rounded-md object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-white">
            {card.name}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            {card.quantity}{" "}
            {card.quantity === 1
              ? "copy"
              : "copies"}
          </p>
        </div>
      </button>

      {open ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 z-[80] ml-4 w-[220px] -translate-y-1/2 rounded-[20px] border border-cyan-300/[0.14] bg-[#04101a]/98 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.58),0_0_28px_rgba(34,211,238,0.10)] backdrop-blur-xl"
        >
          <img
            src={imageSource}
            alt={card.name}
            className="aspect-[0.715] w-full rounded-2xl object-cover"
          />
          <p className="mt-3 text-[14px] font-semibold text-white">
            {card.name}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              MV {card.manaValue}
            </span>
            <span className="text-[12px] font-semibold text-emerald-200">
              ${card.price.toFixed(2)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function edhrecCardUrl(cardName: string) {
  const slug = cardName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `https://edhrec.com/cards/${slug}`;
}

function InspectorAction({
  children,
  tone,
  href,
  onClick,
}: {
  children: ReactNode;
  tone: "cyan" | "violet" | "rose";
  href?: string;
  onClick?: () => void;
}) {
  const className = [
    "flex h-11 w-full appearance-none items-center justify-center rounded-xl border px-4 text-center text-[13px] font-semibold leading-none tracking-normal transition",
    tone === "cyan"
      ? "border-cyan-300/[0.12] bg-cyan-400/[0.035] text-cyan-200 hover:border-cyan-200/30 hover:bg-cyan-400/[0.07]"
      : tone === "violet"
        ? "border-violet-300/[0.12] bg-violet-400/[0.035] text-violet-200 hover:border-violet-200/30 hover:bg-violet-400/[0.07]"
        : "border-rose-300/[0.12] bg-rose-400/[0.035] text-rose-200 hover:border-rose-200/30 hover:bg-rose-400/[0.07]",
  ].join(" ");

  const sharedStyle = {
    fontFamily: "inherit",
    fontSize: "13px",
    fontWeight: 600,
  };

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
        style={sharedStyle}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={sharedStyle}
    >
      {children}
    </button>
  );
}

function CurveMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.055] bg-white/[0.015] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-600">
        {label}
      </p>
      <p className="mt-2 text-[16px] font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function InspectorMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.055] bg-black/[0.08] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-600">
        {label}
      </p>
      <p className="mt-1.5 text-[14px] font-semibold text-slate-100">
        {value}
      </p>
    </div>
  );
}

function DeckCardTile({
  card,
  removeCard,
  standalone = false,
  format = "EDH",
  copyLimit = 1,
}: {
  card: DeckCard;
  removeCard: (id: string) => void;
  standalone?: boolean;
  format?: DeckFormat;
  copyLimit?: number;
}) {
  const [imageFailed, setImageFailed] =
    useState(false);

  const imageSource =
    card.image ||
    `/api/deck-vault/card-image?name=${encodeURIComponent(
      card.name,
    )}`;

  const basicLand =
    /^(plains|island|swamp|mountain|forest|wastes)$/i.test(
      card.name,
    );

  const bannedByFormat: Record<string, string[]> = {
    Commander: [
      "Balance",
      "Biorhythm",
      "Black Lotus",
      "Channel",
      "Coalition Victory",
      "Emrakul, the Aeons Torn",
      "Erayo, Soratami Ascendant",
      "Gifts Ungiven",
      "Griselbrand",
      "Hullbreacher",
      "Iona, Shield of Emeria",
      "Karakas",
      "Leovold, Emissary of Trest",
      "Library of Alexandria",
      "Limited Resources",
      "Lutri, the Spellchaser",
      "Mox Emerald",
      "Mox Jet",
      "Mox Pearl",
      "Mox Ruby",
      "Mox Sapphire",
      "Panoptic Mirror",
      "Paradox Engine",
      "Primeval Titan",
      "Prophet of Kruphix",
      "Recurring Nightmare",
      "Rofellos, Llanowar Emissary",
      "Shahrazad",
      "Sundering Titan",
      "Sway of the Stars",
      "Sylvan Primordial",
      "Tinker",
      "Tolarian Academy",
      "Trade Secrets",
      "Upheaval",
      "Yawgmoth's Bargain",
    ],
  };

  const banned =
    card.legalityStatus === "banned" ||
    (bannedByFormat[format]?.some(
      (name) =>
        name.toLowerCase() ===
        card.name.toLowerCase(),
    ) ?? false);

  const formatIllegal =
    card.legalityStatus === "not_legal" ||
    card.legalityStatus === "restricted";

  const duplicateViolation =
    !basicLand && card.quantity > copyLimit;

  const issueLabel = banned
    ? card.legalityMessage ||
      `This card is banned in ${format}.`
    : formatIllegal
      ? card.legalityMessage ||
        `This card is not legal in ${format}.`
      : duplicateViolation
      ? copyLimit === 1
        ? "Duplicate · Singleton"
        : `Copy Limit · Max ${copyLimit}`
      : "";

  useEffect(() => {
    setImageFailed(false);
  }, [imageSource]);

  const glowClass =
    banned || formatIllegal || duplicateViolation
      ? "group-hover:shadow-[0_0_0_1px_rgba(244,63,94,0.8),0_0_34px_rgba(244,63,94,0.5),0_18px_50px_rgba(0,0,0,0.5)]"
      : card.gameChanger
        ? "group-hover:shadow-[0_0_0_1px_rgba(250,204,21,0.58),0_0_26px_rgba(250,204,21,0.28),0_18px_50px_rgba(0,0,0,0.5)]"
        : "group-hover:shadow-[0_0_0_1px_rgba(34,211,238,0.58),0_0_18px_rgba(34,211,238,0.28),0_0_34px_rgba(139,92,246,0.16),0_18px_50px_rgba(0,0,0,0.5)]";

  return (
    <article
      className={[
        "group relative isolate overflow-visible rounded-2xl border bg-black/[0.12] transition duration-300 hover:z-50 hover:-translate-y-3",
        glowClass,
        banned || formatIllegal || duplicateViolation
          ? "border-rose-400/[0.55]"
          : card.gameChanger
            ? "border-amber-300/[0.22]"
            : "border-white/[0.07]",
        standalone
          ? "shadow-[0_20px_50px_rgba(76,29,149,0.22)]"
          : "",
      ].join(" ")}
    >
      <div
        className={[
          "relative aspect-[0.715] overflow-hidden rounded-t-2xl bg-[#020617] transition duration-300 ease-out",
          standalone
            ? ""
            : "origin-bottom group-hover:scale-[1.28] group-hover:rounded-2xl",
        ].join(" ")}
      >
        {!imageFailed ? (
          <img
            src={imageSource}
            alt={card.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-slate-950 to-sky-950/30 p-4 text-center">
            <span className="text-[9px] font-semibold text-slate-400">
              {card.name}
            </span>
          </div>
        )}

        {issueLabel && !standalone ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-rose-600/92 p-4 text-center opacity-0 backdrop-blur-[2px] transition duration-200 group-hover:opacity-100">
            <div>
              <AlertTriangle className="mx-auto h-7 w-7 text-white" />
              <p className="mt-3 text-[12px] font-black uppercase tracking-[0.08em] text-white">
                {banned
                  ? "Banned in this format"
                  : formatIllegal
                    ? "Illegal in this format"
                    : "Deck construction error"}
              </p>
              <p className="mt-2 text-[11px] leading-4 text-rose-50">
                {issueLabel}
              </p>
            </div>
          </div>
        ) : null}

        {!standalone ? (
          <>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                removeCard(card.id);
              }}
              aria-label={`Remove ${card.name} from deck`}
              title="Remove from deck"
              className="absolute right-2 top-2 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/75 text-slate-300 opacity-0 shadow-lg backdrop-blur transition hover:border-rose-300/30 hover:bg-rose-950/90 hover:text-rose-200 group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}

        {card.gameChanger ? (
          <div className="absolute left-2 top-2 z-20 flex items-center gap-1 rounded-lg border border-amber-100/35 bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 px-2 py-1.5 text-[6px] font-black uppercase tracking-[0.08em] text-amber-950 shadow-[0_0_20px_rgba(250,204,21,0.42)]">
            <Sparkles className="h-3 w-3" />
            Game Changer
          </div>
        ) : null}

        {!standalone ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent px-3 pb-3 pt-10 opacity-0 transition group-hover:opacity-100">
            <p className="text-center text-[8px] font-semibold text-white">
              {card.name}
            </p>
            <p className="mt-1 text-center text-[7px] font-semibold text-cyan-200">
              ${card.price.toFixed(2)}
            </p>
          </div>
        ) : null}
      </div>

      {!standalone ? (
        <div className="rounded-b-2xl border-t border-white/[0.045] bg-[linear-gradient(180deg,rgba(255,255,255,0.012),rgba(0,0,0,0.06))] px-2.5 py-2.5">
          <p className="line-clamp-2 min-h-7 text-center text-[8px] font-semibold leading-3.5 text-white">
            {card.name}
          </p>

          <div className="mt-2 flex items-center justify-center gap-2">
            {card.quantity > 1 || basicLand ? (
              <span
                className={[
                  "rounded-md border px-2 py-1 text-[7px] font-semibold",
                  duplicateViolation
                    ? "border-rose-300/20 bg-rose-400/[0.08] text-rose-200"
                    : "border-cyan-300/[0.12] bg-cyan-400/[0.035] text-cyan-200",
                ].join(" ")}
              >
                {card.quantity} copies
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">
                Single copy
              </span>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
function BuilderMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.055] bg-black/[0.08] p-3">
      <p className="text-[6px] uppercase tracking-[0.1em] text-slate-700">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-200">
        {value}
      </p>
    </div>
  );
}

function DoctorNote({
  tone,
  text,
}: {
  tone: "good" | "warn";
  text: string;
}) {
  return (
    <div
      className={[
        "rounded-xl border p-3 text-[8px] leading-4",
        tone === "good"
          ? "border-emerald-300/[0.1] bg-emerald-400/[0.025] text-emerald-200"
          : "border-amber-300/[0.1] bg-amber-400/[0.025] text-amber-200",
      ].join(" ")}
    >
      {text}
    </div>
  );
}
function DeckCardRow({
  card,
  removeCard,
}: {
  card: DeckCard;
  removeCard: (id: string) => void;
}) {
  const [imageFailed, setImageFailed] =
    useState(false);
  const imageSource =
    card.image ||
    `/api/deck-vault/card-image?name=${encodeURIComponent(
      card.name,
    )}`;

  useEffect(() => {
    setImageFailed(false);
  }, [imageSource]);

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-white/[0.06] bg-slate-950">
        {!imageFailed ? (
          <img
            src={imageSource}
            alt={card.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <span className="w-8 text-center text-[9px] font-semibold text-sky-300">
        {card.quantity}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-white">
          {card.name}
        </p>
        <p className="mt-1 text-[7px] text-slate-600">
          {card.typeLine}
        </p>
      </div>

      {card.gameChanger ? (
        <span className="rounded-lg border border-violet-300/[0.12] bg-violet-400/[0.035] px-2 py-1 text-[6px] font-semibold text-violet-200">
          Game Changer
        </span>
      ) : null}

      <span className="text-[8px] text-slate-500">
        ${card.price.toFixed(2)}
      </span>

      <button
        type="button"
        onClick={() => removeCard(card.id)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300/[0.1] text-rose-300"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function IntelligenceWorkspace({
  report,
  loading,
  format,
}: {
  report: DeckIntelligenceReport | null;
  loading: boolean;
  format: DeckFormat;
}) {
  const errors =
    report?.issues.filter(
      (issue) =>
        issue.severity === "error",
    ) ?? [];
  const warnings =
    report?.issues.filter(
      (issue) =>
        issue.severity === "warning",
    ) ?? [];

  return (
    <section className="mt-6 space-y-5">
      <section className="relative overflow-hidden rounded-[30px] border border-cyan-300/[0.13] bg-[#06131f] p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,0.12),transparent_35%),radial-gradient(circle_at_90%_10%,rgba(139,92,246,0.10),transparent_32%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
              Live Deck Intelligence
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white">
              {format} Validation Center
            </h2>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-400">
              Format legality, copy limits, deck size, command-zone compatibility,
              token requirements, and inventory readiness update as the deck changes.
            </p>
          </div>

          <div className={[
            "rounded-2xl border px-5 py-4 text-center",
            report?.valid
              ? "border-emerald-300/[0.14] bg-emerald-400/[0.035]"
              : "border-rose-300/[0.18] bg-rose-400/[0.045]",
          ].join(" ")}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Deck Status
            </p>
            <p className={[
              "mt-2 text-2xl font-semibold",
              report?.valid
                ? "text-emerald-200"
                : "text-rose-200",
            ].join(" ")}>
              {loading
                ? "Checking…"
                : report?.valid
                  ? "Format Legal"
                  : "Needs Attention"}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <IntelligenceMetric
          label="Errors"
          value={`${errors.length}`}
          detail="Must be corrected"
          tone="rose"
        />
        <IntelligenceMetric
          label="Warnings"
          value={`${warnings.length}`}
          detail="Review recommended"
          tone="amber"
        />
        <IntelligenceMetric
          label="Token Types"
          value={`${report?.tokens.length ?? 0}`}
          detail="Detected game objects"
          tone="cyan"
        />
      </div>

      <section className="rounded-[28px] border border-white/[0.07] bg-[#06131f] p-6">
        <h3 className="text-[20px] font-semibold text-white">
          Validation Results
        </h3>
        <p className="mt-2 text-[13px] text-slate-500">
          Illegal cards receive a bright red hover overlay in Grid View and a status badge in Table View.
        </p>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {report?.issues.length ? (
            report.issues.map((issue, index) => (
              <div
                key={`${issue.code}-${issue.cardId ?? index}`}
                className={[
                  "rounded-2xl border p-4",
                  issue.severity === "error"
                    ? "border-rose-300/[0.16] bg-rose-400/[0.035]"
                    : "border-amber-300/[0.13] bg-amber-400/[0.03]",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={[
                    "mt-0.5 h-5 w-5 shrink-0",
                    issue.severity === "error"
                      ? "text-rose-300"
                      : "text-amber-300",
                  ].join(" ")} />
                  <div>
                    <p className="text-[14px] font-semibold text-white">
                      {issue.cardName ?? "Deck construction"}
                    </p>
                    <p className="mt-2 text-[13px] leading-5 text-slate-400">
                      {issue.message}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full rounded-2xl border border-emerald-300/[0.12] bg-emerald-400/[0.025] p-5 text-[14px] text-emerald-200">
              No format or command-zone issues were detected.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

function TokenWorkspace({
  report,
  loading,
}: {
  report: DeckIntelligenceReport | null;
  loading: boolean;
}) {
  const tokens = (report?.tokens ?? []).filter(
    (token) =>
      token.name.trim().length > 1 &&
      !/\b(?:that'?s|target|copy of|of target|or more|or sacrifice|twice of those|of those)\b/i.test(
        token.name,
      ) &&
      (Boolean(token.image) ||
        /\bEmblem$/i.test(token.name) ||
        [
          "Angel",
          "Army",
          "Beast",
          "Bird",
          "Blood",
          "Clue",
          "Construct",
          "Dragon",
          "Eldrazi Spawn",
          "Eldrazi Scion",
          "Elephant",
          "Faerie",
          "Food",
          "Goblin",
          "Gold",
          "Golem",
          "Human",
          "Insect",
          "Knight",
          "Map",
          "Plant",
          "Powerstone",
          "Rat",
          "Role",
          "Saproling",
          "Servo",
          "Soldier",
          "Spider",
          "Spirit",
          "Squirrel",
          "Thopter",
          "Treasure",
          "Vampire",
          "Warrior",
          "Wolf",
          "Zombie",
        ].includes(token.name)),
  );
  const support =
    report?.tokenSupport ?? [];

  const supportGroups = [
    {
      role: "multiplier" as const,
      title: "Token Multipliers",
      description:
        "Increase the number of tokens created. These do not add a new physical token type.",
    },
    {
      role: "copier" as const,
      title: "Token Copiers",
      description:
        "Copy or populate token types already produced elsewhere in the deck.",
    },
    {
      role: "payoff" as const,
      title: "Token Payoffs",
      description:
        "Reward or modify tokens without creating a new named token.",
    },
    {
      role: "consumer" as const,
      title: "Token Consumers",
      description:
        "Use tokens as a resource for costs, sacrifice, or activated abilities.",
    },
  ].map((group) => ({
    ...group,
    cards: support.filter(
      (card) =>
        card.role === group.role,
    ),
  }));

  return (
    <section className="mt-6 space-y-5">
      <section className="rounded-[26px] border border-violet-300/[0.12] bg-[#06131f] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-300">
              Token Intelligence
            </p>
            <h2 className="mt-3 text-[28px] font-semibold text-white">
              Complete token kit
            </h2>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-slate-400">
              Only genuine token types enter the physical token kit. Multipliers,
              payoffs, copiers, and token consumers are classified separately.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-violet-300/[0.12] bg-violet-400/[0.035] px-5 py-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Unique tokens
              </p>
              <p className="mt-1 text-3xl font-semibold text-violet-200">
                {tokens.length}
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-300/[0.12] bg-cyan-400/[0.035] px-5 py-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Support cards
              </p>
              <p className="mt-1 text-3xl font-semibold text-cyan-200">
                {support.length}
              </p>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#06131f] p-6 text-[14px] text-slate-500">
          Classifying token producers and support cards…
        </div>
      ) : (
        <>
          <section className="rounded-[26px] border border-white/[0.07] bg-[#06131f] p-5">
            <div>
              <p className="text-[18px] font-semibold text-white">
                Required Token Kit
              </p>
              <p className="mt-1 text-[12px] text-slate-500">
                Bring one physical card for each unique token below. Use dice or counters for additional copies.
              </p>
            </div>

            {tokens.length ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {tokens.map((token) => (
                  <article
                    key={token.name}
                    className="group overflow-hidden rounded-[22px] border border-white/[0.07] bg-black/[0.09] transition duration-200 hover:-translate-y-0.5 hover:border-violet-300/[0.16] hover:shadow-[0_18px_50px_rgba(0,0,0,0.28),0_0_24px_rgba(139,92,246,0.08)]"
                  >
                    <div className="relative aspect-[1.55] overflow-hidden bg-violet-400/[0.03]">
                      {token.image ? (
                        <img
                          src={token.image}
                          alt={token.name}
                          loading="lazy"
                          className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.025]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.08),transparent_70%)]">
                          <div className="text-center">
                            <Sparkles className="mx-auto h-7 w-7 text-violet-300" />
                            <p className="mt-3 text-[12px] font-semibold text-violet-100">
                              {token.name}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="absolute left-3 top-3 rounded-full border border-white/[0.12] bg-[#03101a]/88 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-100 backdrop-blur">
                        Required Token
                      </div>
                    </div>

                    <div className="p-4">
                      <h3 className="text-[17px] font-semibold text-white">
                        {token.name}
                      </h3>

                      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
                        Created by
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {token.createdBy.map(
                          (name) => (
                            <span
                              key={name}
                              className="rounded-full border border-white/[0.06] bg-white/[0.015] px-2.5 py-1.5 text-[10px] leading-4 text-slate-400"
                            >
                              {name}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-white/[0.06] bg-black/[0.08] p-5 text-[13px] text-slate-500">
                No genuine token-producing effects were detected in the current list.
              </div>
            )}
          </section>

          {supportGroups
            .filter(
              (group) =>
                group.cards.length,
            )
            .map((group) => (
              <section
                key={group.role}
                className="rounded-[26px] border border-white/[0.07] bg-[#06131f] p-5"
              >
                <div>
                  <p className="text-[18px] font-semibold text-white">
                    {group.title}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {group.description}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.cards.map((card) => (
                    <article
                      key={`${group.role}-${card.cardName}`}
                      className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[14px] font-semibold text-white">
                          {card.cardName}
                        </p>
                        <span className="rounded-full border border-cyan-300/[0.1] bg-cyan-400/[0.025] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-cyan-200">
                          {card.role}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] leading-5 text-slate-500">
                        {card.explanation}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
        </>
      )}
    </section>
  );
}

function OwnershipIntelligenceWorkspace({
  report,
  loading,
}: {
  report: DeckIntelligenceReport | null;
  loading: boolean;
}) {
  const rows = report?.ownership ?? [];
  const complete = rows.filter(
    (row) => row.owned >= row.required,
  ).length;
  const missing = rows.filter(
    (row) => row.owned < row.required,
  );

  return (
    <section className="mt-6 space-y-5">
      <section className="rounded-[30px] border border-emerald-300/[0.11] bg-[#06131f] p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
          Inventory Intelligence
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-white">
          Know what you own, where it is, and where it is listed.
        </h2>
        <p className="mt-3 max-w-4xl text-[14px] leading-6 text-slate-400">
          Matches the deck against Trading Docks inventory data, including physical
          location, condition, printing, marketplace, listing ID, and reservation state.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <IntelligenceMetric
          label="Complete"
          value={`${complete}`}
          detail="Cards fully covered"
          tone="emerald"
        />
        <IntelligenceMetric
          label="Missing"
          value={`${missing.length}`}
          detail="Need additional copies"
          tone="amber"
        />
        <IntelligenceMetric
          label="Inventory Rows"
          value={`${rows.length}`}
          detail="Deck cards checked"
          tone="cyan"
        />
      </div>

      <section className="overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#06131f]">
        <div className="border-b border-white/[0.055] px-5 py-4">
          <h3 className="text-[18px] font-semibold text-white">
            Ownership Map
          </h3>
        </div>

        <div className="divide-y divide-white/[0.045]">
          {loading ? (
            <p className="p-5 text-[13px] text-slate-500">
              Checking inventory…
            </p>
          ) : rows.map((row) => (
            <div
              key={row.cardId}
              className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(180px,1fr)_100px_100px_2fr]"
            >
              <div>
                <p className="text-[14px] font-semibold text-white">
                  {row.cardName}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Need {row.required}
                </p>
              </div>
              <p className={[
                "text-[13px] font-semibold",
                row.owned >= row.required
                  ? "text-emerald-200"
                  : "text-amber-200",
              ].join(" ")}>
                {row.owned} owned
              </p>
              <p className="text-[13px] text-slate-400">
                {row.matches.length} locations
              </p>
              <div className="flex flex-wrap gap-2">
                {row.matches.length ? row.matches.map((match) => (
                  <InventoryMatchChip
                    key={match.inventoryId}
                    match={match}
                  />
                )) : (
                  <span className="rounded-full border border-amber-300/[0.1] bg-amber-400/[0.025] px-3 py-1.5 text-[11px] text-amber-200">
                    Not found in inventory
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function InventoryMatchChip({
  match,
}: {
  match: InventoryMatch;
}) {
  return (
    <span className="rounded-xl border border-white/[0.065] bg-white/[0.015] px-3 py-2 text-[11px] text-slate-400">
      <strong className="text-slate-200">
        {match.quantity}×
      </strong>{" "}
      {match.location} · {match.condition}
      {match.platform
        ? ` · ${match.platform}`
        : ""}
      {match.reservedForDeck
        ? " · Reserved"
        : ""}
    </span>
  );
}

function IntelligenceMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "cyan" | "rose" | "amber" | "emerald";
}) {
  const tones = {
    cyan: "border-cyan-300/[0.11] bg-cyan-400/[0.025] text-cyan-200",
    rose: "border-rose-300/[0.12] bg-rose-400/[0.03] text-rose-200",
    amber: "border-amber-300/[0.11] bg-amber-400/[0.025] text-amber-200",
    emerald: "border-emerald-300/[0.11] bg-emerald-400/[0.025] text-emerald-200",
  }[tone];

  return (
    <div className={[
      "rounded-[22px] border p-5",
      tones,
    ].join(" ")}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-75">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-white">
        {value}
      </p>
      <p className="mt-2 text-[12px] opacity-70">
        {detail}
      </p>
    </div>
  );
}

function AnalyticsWorkspace({
  deck,
  cards,
  analytics,
  bracket,
  isCommander,
  format,
  commanderName,
  intelligence,
  openCards,
}: {
  deck: DeckRecord;
  cards: DeckCard[];
  analytics: ReturnType<typeof deckAnalytics>;
  bracket: ReturnType<
    typeof evaluateCommanderBracket
  >;
  isCommander: boolean;
  format: DeckFormat;
  commanderName: string;
  intelligence: DeckIntelligenceReport | null;
  openCards: () => void;
}) {
  const mainDeckCards = cards.filter(
    (card) =>
      card.board !== "commander" &&
      card.category !== "Commander",
  );
  const totalCards = mainDeckCards.reduce(
    (sum, card) => sum + card.quantity,
    0,
  );
  const ownedCards = mainDeckCards.reduce(
    (sum, card) =>
      sum + (card.owned ? card.quantity : 0),
    0,
  );
  const missingCards = Math.max(
    0,
    totalCards - ownedCards,
  );
  const healthScore = isCommander
    ? Math.max(
        48,
        Math.min(
          96,
          70 +
            bracket.bracket * 4 -
            Math.max(
              0,
              analytics.averageManaValue - 3.5,
            ) *
              4,
        ),
      )
    : 87;

  const legalityReady =
    intelligence?.valid ?? true;
  const ownershipReady =
    missingCards === 0;
  const tokenReady =
    Boolean(
      intelligence &&
        intelligence.tokens.length > 0,
    );
  const readinessScore = Math.round(
    (legalityReady ? 40 : 10) +
      (ownershipReady ? 35 : Math.max(
        5,
        35 -
          Math.min(
            30,
            missingCards * 2,
          ),
      )) +
      (tokenReady ? 15 : 7) +
      (healthScore >= 80 ? 10 : 6),
  );

  return (
    <section className="mt-6 space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-cyan-300/[0.12] bg-[#06131f] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.28)] sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.10),transparent_33%),radial-gradient(circle_at_82%_20%,rgba(139,92,246,0.09),transparent_30%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(56,189,248,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.018)_1px,transparent_1px)] bg-[size:34px_34px]" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-cyan-300/[0.16] bg-cyan-400/[0.05] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
                Deck Intelligence
              </span>
              <span className="text-[12px] text-slate-500">
                Live analysis
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              {commanderName || deck.name}
            </h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-400">
              A format-aware view of deck health, color balance, collection readiness,
              power level, and the highest-impact improvements available right now.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CommandMetric
              label="Deck Health"
              value={`${Math.round(healthScore)}`}
              detail="Live score"
              tone="violet"
            />
            <CommandMetric
              label="Main Deck"
              value={`${totalCards}`}
              detail={`${format} cards`}
              tone="cyan"
            />
            <CommandMetric
              label="Owned"
              value={`${ownedCards}`}
              detail={`${missingCards} missing`}
              tone="emerald"
            />
            <CommandMetric
              label="Market Value"
              value={`$${deck.marketValue.toFixed(2)}`}
              detail="Current estimate"
              tone="amber"
            />
          </div>
        </div>
      </section>

      <DeckDoctorRecommendations
        cards={cards}
        format={format}
        commanderName={commanderName}
      />

      <section className="rounded-[28px] border border-emerald-300/[0.11] bg-[#06131f] p-6">
        <div className="grid gap-6 xl:grid-cols-[190px_minmax(0,1fr)] xl:items-center">
          <div className="rounded-2xl border border-emerald-300/[0.12] bg-emerald-400/[0.03] p-5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
              Deck Readiness
            </p>
            <p className="mt-3 text-5xl font-semibold text-white">
              {readinessScore}%
            </p>
            <p className="mt-2 text-[12px] text-slate-500">
              Ready for the deck box
            </p>
          </div>

          <div>
            <h2 className="text-[20px] font-semibold text-white">
              Pre-game readiness checklist
            </h2>
            <p className="mt-2 text-[13px] leading-5 text-slate-500">
              Combines legality, ownership, token preparation, and deck health into one actionable status.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ReadinessCheck
                label="Format"
                ready={legalityReady}
                detail={
                  legalityReady
                    ? "Deck is legal"
                    : `${intelligence?.issues.filter(
                        (issue) =>
                          issue.severity ===
                          "error",
                      ).length ?? 0} errors`
                }
              />
              <ReadinessCheck
                label="Ownership"
                ready={ownershipReady}
                detail={
                  ownershipReady
                    ? "Complete"
                    : `${missingCards} missing`
                }
              />
              <ReadinessCheck
                label="Tokens"
                ready={tokenReady}
                detail={
                  tokenReady
                    ? `${intelligence?.tokens.length ?? 0} types detected`
                    : "Review token kit"
                }
              />
              <ReadinessCheck
                label="Deck Health"
                ready={healthScore >= 80}
                detail={`${Math.round(
                  healthScore,
                )}/100`}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              icon={BarChart3}
              title="Mana Curve"
              subtitle="Nonland cards grouped by mana value"
            >
              <div className="mt-6">
                <div className="flex h-40 items-end gap-3 rounded-2xl border border-white/[0.045] bg-black/[0.08] px-4 pt-4">
                  {analytics.manaCurve.map((item) => {
                    const max = Math.max(
                      ...analytics.manaCurve.map(
                        (entry) => entry.value,
                      ),
                      1,
                    );
                    const height = Math.max(
                      10,
                      (item.value / max) * 112,
                    );

                    return (
                      <div
                        key={item.label}
                        className="group flex flex-1 flex-col items-center justify-end gap-2"
                      >
                        <span className="text-[12px] font-semibold text-slate-200">
                          {item.value}
                        </span>
                        <div
                          className="w-full max-w-[44px] rounded-t-xl border border-cyan-200/[0.1] bg-gradient-to-t from-sky-700 via-sky-500 to-cyan-300 shadow-[0_0_20px_rgba(56,189,248,0.10)] transition duration-300 group-hover:shadow-[0_0_30px_rgba(56,189,248,0.26)]"
                          style={{ height }}
                        />
                        <span className="pb-2 text-[11px] text-slate-500">
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <CurveMetric
                    label="Average MV"
                    value={analytics.averageManaValue.toFixed(2)}
                  />
                  <CurveMetric
                    label="Cards 1–3 MV"
                    value={`${analytics.manaCurve
                      .slice(1, 4)
                      .reduce(
                        (sum, item) =>
                          sum + item.value,
                        0,
                      )}`}
                  />
                  <CurveMetric
                    label="Cards 5+ MV"
                    value={`${analytics.manaCurve
                      .slice(5)
                      .reduce(
                        (sum, item) =>
                          sum + item.value,
                        0,
                      )}`}
                  />
                  <CurveMetric
                    label="Peak MV"
                    value={
                      analytics.manaCurve.reduce(
                        (highest, item) =>
                          item.value >
                          highest.value
                            ? item
                            : highest,
                        {
                          label: "—",
                          value: -1,
                        },
                      ).label
                    }
                  />
                </div>
              </div>
            </Panel>

            <Panel
              icon={Layers3}
              title="Color Demand"
              subtitle="Cards contributing to each color"
            >
              <div className="mt-6">
                <ColorDemandPie
                  rows={analytics.colorDemand}
                  cards={mainDeckCards}
                />
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              icon={Layers3}
              title="Deck Composition"
              subtitle="Card types across the current list"
            >
              <MetricBars
                rows={analytics.types}
                max={40}
              />
            </Panel>

            <Panel
              icon={BrainCircuit}
              title="Deck Fundamentals"
              subtitle="Functional coverage by role"
            >
              <MetricBars
                rows={analytics.categories}
                max={15}
              />
            </Panel>
          </div>

          <section className="rounded-[28px] border border-white/[0.07] bg-[#06131f] p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[18px] font-semibold text-white">
                  Current Deck List
                </p>
                <p className="mt-1 text-[13px] text-slate-500">
                  Preview the current construction or return to the full editor.
                </p>
              </div>
              <button
                type="button"
                onClick={openCards}
                className="h-11 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-300 px-5 text-[13px] font-semibold text-[#00121c] shadow-[0_0_24px_rgba(34,211,238,0.14)] transition hover:brightness-110"
              >
                Open Deck Editor
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {mainDeckCards.slice(0, 8).map((card) => (
                <div
                  key={card.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-3 transition hover:border-cyan-300/[0.13]"
                >
                  {card.image ? (
                    <img
                      src={card.image}
                      alt={card.name}
                      className="h-16 w-12 rounded-lg object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-white">
                      {card.name}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {card.quantity === 1
                        ? "Single copy"
                        : `${card.quantity} copies`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-5 xl:self-start">
          <section className="rounded-[28px] border border-violet-300/[0.12] bg-[#06131f] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/[0.15] bg-violet-400/[0.05]">
                <BrainCircuit className="h-5 w-5 text-violet-200" />
              </div>
              <div>
                <p className="text-[18px] font-semibold text-white">
                  AI Deck Review
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  Format-aware strategic profile
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-violet-300/[0.11] bg-violet-400/[0.025] p-5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {isCommander
                  ? "Commander Bracket"
                  : "Deck Health"}
              </p>
              <p className="mt-2 text-5xl font-semibold text-violet-200">
                {isCommander
                  ? bracket.bracket
                  : Math.round(healthScore)}
              </p>
              <p className="mt-2 text-[14px] font-semibold text-violet-300">
                {isCommander
                  ? bracket.name
                  : `${format} Review`}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniMetric
                label="Game Changers"
                value={`${bracket.gameChangerCount}`}
              />
              <MiniMetric
                label="Average MV"
                value={analytics.averageManaValue.toFixed(2)}
              />
              <MiniMetric
                label="Missing"
                value={`${missingCards}`}
              />
              <MiniMetric
                label="Power"
                value={`${deck.power.toFixed(1)}/10`}
              />
            </div>

            {isCommander && bracket.gameChangers.length ? (
              <div className="mt-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-amber-200">
                  Game Changers
                </p>
                <div className="mt-3 space-y-2">
                  {bracket.gameChangers.map((name) => (
                    <div
                      key={name}
                      className="rounded-xl border border-amber-300/[0.1] bg-amber-400/[0.025] px-4 py-3 text-[13px] text-amber-100"
                    >
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              {bracket.reasons.map((reason) => (
                <p
                  key={reason}
                  className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4 text-[13px] leading-5 text-slate-400"
                >
                  {reason}
                </p>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-emerald-300/[0.1] bg-[#06131f] p-6">
            <p className="text-[18px] font-semibold text-white">
              Collection Status
            </p>
            <p className="mt-1 text-[12px] text-slate-500">
              Completion, acquisition, and upgrade readiness
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniMetric
                label="Owned Cards"
                value={`${ownedCards}`}
              />
              <MiniMetric
                label="Missing Cards"
                value={`${missingCards}`}
              />
              <MiniMetric
                label="Missing Cost"
                value={`$${cards
                  .filter((card) => !card.owned)
                  .reduce(
                    (total, card) =>
                      total + card.price * card.quantity,
                    0,
                  )
                  .toFixed(2)}`}
              />
              <MiniMetric
                label="Alternate Art"
                value="0"
              />
            </div>

            <button className="mt-5 h-12 w-full rounded-xl bg-gradient-to-r from-emerald-300 to-teal-300 text-[13px] font-semibold text-[#00140d] transition hover:brightness-110">
              Create Want List
            </button>
          </section>
        </aside>
      </div>
    </section>
  );
}

function inferCategory(card: ScryfallCardResult) {
  if (/Land/i.test(card.typeLine)) return "Land";
  if (/Mana|Treasure/i.test(card.name))
    return "Ramp";
  if (/Tutor/i.test(card.name)) return "Tutor";
  if (/Destroy|Exile|Counter/i.test(card.name))
    return "Removal";
  return "Other";
}

function ManaSymbols({
  colors,
  size = "md",
}: {
  colors: ManaColor[];
  size?: "sm" | "md" | "lg";
}) {
  const wrapperSize = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-11 w-11",
  }[size];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {colors.map((color) => (
        <span
          key={color}
          title={`${manaName(color)} mana`}
          className={[
            "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-slate-950 shadow-[0_2px_8px_rgba(0,0,0,0.38)]",
            wrapperSize,
          ].join(" ")}
        >
          <img
            src={manaSymbolUrl(color)}
            alt={`${manaName(color)} mana`}
            loading="eager"
            className="h-[92%] w-[92%] object-contain"
          />
        </span>
      ))}
    </div>
  );
}

function manaSymbolUrl(color: ManaColor) {
  const symbol = color === "C" ? "C" : color;
  return `https://svgs.scryfall.io/card-symbols/${symbol}.svg`;
}

function manaName(color: ManaColor) {
  return {
    W: "White",
    U: "Blue",
    B: "Black",
    R: "Red",
    G: "Green",
    C: "Colorless",
  }[color];
}

function ColorDemandPie({
  rows: _rows,
  cards,
}: {
  rows: Array<{
    color: ManaColor;
    value: number;
  }>;
  cards: DeckCard[];
}) {
  const [activeColor, setActiveColor] =
    useState<ManaColor | null>(null);

  const colors: ManaColor[] = [
    "W",
    "U",
    "B",
    "R",
    "G",
  ];

  const palette: Record<ManaColor, string> = {
    W: "#f8f1df",
    U: "#1d8ed1",
    B: "#55483f",
    R: "#e84d55",
    G: "#16a36b",
    C: "#94a3b8",
  };

  const cardCounts = colors.map((color) => ({
    color,
    count: cards.reduce(
      (sum, card) =>
        sum +
        (card.colors.includes(color)
          ? card.quantity
          : 0),
      0,
    ),
  }));

  const total = Math.max(
    1,
    cardCounts.reduce(
      (sum, entry) =>
        sum + entry.count,
      0,
    ),
  );

  const radius = 72;
  const circumference =
    2 * Math.PI * radius;
  const gap = 5;
  let offset = 0;

  const activeEntry = activeColor
    ? cardCounts.find(
        (entry) =>
          entry.color === activeColor,
      )
    : null;

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid min-w-0 gap-6 xl:grid-cols-[210px_minmax(0,1fr)] xl:items-center">
        <div className="relative mx-auto h-[205px] w-[205px] max-w-full">
          <div className="absolute inset-5 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.08),transparent_65%)] blur-xl" />

          <svg
            viewBox="0 0 220 220"
            className="relative h-full w-full -rotate-90"
            role="img"
            aria-label="Color demand by cards"
          >
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.045)"
              strokeWidth="26"
            />

            {cardCounts.map((entry) => {
              const rawLength =
                (entry.count / total) *
                circumference;
              const segmentLength =
                Math.max(
                  0,
                  rawLength - gap,
                );
              const dashOffset = -offset;
              offset += rawLength;

              return (
                <circle
                  key={entry.color}
                  cx="110"
                  cy="110"
                  r={radius}
                  fill="none"
                  stroke={
                    palette[entry.color]
                  }
                  strokeWidth={
                    activeColor ===
                    entry.color
                      ? 32
                      : 26
                  }
                  strokeLinecap="round"
                  strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                  strokeDashoffset={
                    dashOffset
                  }
                  className="cursor-pointer transition-all duration-300"
                  onMouseEnter={() =>
                    setActiveColor(
                      entry.color,
                    )
                  }
                  onMouseLeave={() =>
                    setActiveColor(null)
                  }
                />
              );
            })}
          </svg>

          <div className="absolute inset-[52px] flex items-center justify-center rounded-full border border-white/[0.07] bg-[#06131f] shadow-[inset_0_0_32px_rgba(0,0,0,0.35)]">
            <div className="text-center">
              <p className="text-4xl font-semibold text-white">
                {activeEntry
                  ? activeEntry.count
                  : total}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                {activeEntry
                  ? `${manaName(
                      activeEntry.color,
                    )} Cards`
                  : "Color Cards"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {cardCounts.map((entry) => {
            const percentage =
              (entry.count / total) * 100;

            return (
              <button
                key={entry.color}
                type="button"
                onMouseEnter={() =>
                  setActiveColor(entry.color)
                }
                onMouseLeave={() =>
                  setActiveColor(null)
                }
                className={[
                  "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                  activeColor ===
                  entry.color
                    ? "border-cyan-300/[0.18] bg-cyan-400/[0.04]"
                    : "border-white/[0.055] bg-white/[0.015]",
                ].join(" ")}
              >
                <ManaSymbols
                  colors={[entry.color]}
                  size="sm"
                />

                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-white">
                    {manaName(entry.color)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {entry.count}{" "}
                    {entry.count === 1
                      ? "card"
                      : "cards"}
                  </p>
                </div>

                <span className="shrink-0 rounded-lg border border-white/[0.055] bg-black/[0.08] px-2 py-1 text-[13px] font-semibold text-slate-100">
                  {percentage.toFixed(0)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-5">
        {cardCounts.map((entry) => (
          <div
            key={entry.color}
            className="min-w-0 rounded-xl border border-white/[0.05] bg-black/[0.08] p-3 text-center"
          >
            <div className="flex justify-center">
              <ManaSymbols
                colors={[entry.color]}
                size="sm"
              />
            </div>
            <p className="mt-2 text-[15px] font-semibold text-white">
              {entry.count}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {entry.count === 1
                ? "card"
                : "cards"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

type DeckDoctorRecommendation = {
  cardName: string;
  image?: string;
  price?: number;
  role: string;
  issue: string;
  reason: string;
  confidence: number;
  replacement?: string;
  scryfallUri?: string;
};

type DeckDoctorReport = {
  score: number;
  summary: string;
  strengths: string[];
  issues: Array<{
    role: string;
    severity: "high" | "medium" | "low";
    current: number;
    target: string;
    explanation: string;
  }>;
  recommendations: DeckDoctorRecommendation[];
  analysisMode: "ai" | "rules";
};

function DeckDoctorRecommendations({
  cards,
  format,
  commanderName,
}: {
  cards: DeckCard[];
  format: DeckFormat;
  commanderName: string;
}) {
  const [report, setReport] =
    useState<DeckDoctorReport | null>(null);
  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState("");

  async function runReview() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/deck-vault/deck-doctor",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cards,
            format,
            commanderName,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          "Deck Doctor could not complete the review.",
        );
      }

      setReport(await response.json());
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Deck Doctor could not complete the review.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runReview();
    // The serialized signature avoids rerunning for unrelated UI state.
  }, [
    format,
    commanderName,
    cards
      .map((card) => `${card.id}:${card.quantity}`)
      .join("|"),
  ]);

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-cyan-300/[0.14] bg-[#06131f] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.24)] sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-300/[0.15] bg-violet-400/[0.05]">
            <BrainCircuit className="h-5 w-5 text-violet-200" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[20px] font-semibold text-white">
                AI Deck Doctor
              </h2>
              {report ? (
                <span className="rounded-full border border-cyan-300/[0.12] bg-cyan-400/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-200">
                  {report.analysisMode === "ai"
                    ? "AI + Scryfall"
                    : "Rules + Scryfall"}
                </span>
              ) : null}
            </div>
            <p className="mt-2 max-w-3xl text-[13px] leading-5 text-slate-400">
              Detects structural gaps, validates candidates against format and color identity,
              then ranks cards for draw, ramp, interaction, protection, finishers, and combo support.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void runReview()}
          disabled={loading}
          className="h-11 rounded-xl border border-cyan-300/[0.18] bg-cyan-400/[0.05] px-5 text-[13px] font-semibold text-cyan-100 transition hover:bg-cyan-400/[0.09] disabled:cursor-wait disabled:opacity-50"
        >
          {loading ? "Analyzing…" : "Run New Review"}
        </button>
      </div>

      {error ? (
        <div className="mt-5 rounded-xl border border-rose-300/[0.12] bg-rose-400/[0.035] p-4 text-[13px] text-rose-200">
          {error}
        </div>
      ) : null}

      {loading && !report ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.02]"
            />
          ))}
        </div>
      ) : null}

      {report ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-[150px_1fr]">
            <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-violet-300/[0.11] bg-violet-400/[0.025] text-center">
              <p className="text-4xl font-semibold text-violet-200">
                {report.score}
              </p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">
                Deck Health
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
              <p className="text-[14px] leading-6 text-slate-300">
                {report.summary}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {report.strengths.map((strength) => (
                  <span
                    key={strength}
                    className="rounded-full border border-emerald-300/[0.11] bg-emerald-400/[0.025] px-3 py-2 text-[11px] text-emerald-200"
                  >
                    {strength}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Issues detected
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {report.issues.map((issue) => (
                <div
                  key={`${issue.role}-${issue.target}`}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[14px] font-semibold text-white">
                      {issue.role}
                    </p>
                    <span
                      className={[
                        "rounded-full px-2 py-1 text-[6px] font-semibold uppercase tracking-[0.08em]",
                        issue.severity === "high"
                          ? "bg-rose-400/[0.1] text-rose-200"
                          : issue.severity === "medium"
                            ? "bg-amber-400/[0.1] text-amber-200"
                            : "bg-sky-400/[0.08] text-sky-200",
                      ].join(" ")}
                    >
                      {issue.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] text-slate-400">
                    Current {issue.current} · Target {issue.target}
                  </p>
                  <p className="mt-2 text-[12px] leading-5 text-slate-500">
                    {issue.explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Recommended cards
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {report.recommendations.map((recommendation) => (
                <article
                  key={`${recommendation.role}-${recommendation.cardName}`}
                  className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-3 transition hover:border-cyan-300/[0.14] hover:bg-cyan-400/[0.02]"
                >
                  {recommendation.image ? (
                    <img
                      src={recommendation.image}
                      alt={recommendation.cardName}
                      loading="lazy"
                      className="h-28 w-20 shrink-0 rounded-xl object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-semibold text-white">
                          {recommendation.cardName}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-300">
                          {recommendation.role}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/[0.06] px-2.5 py-1.5 text-[11px] text-slate-300">
                        {recommendation.confidence}%
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] leading-5 text-slate-400">
                      {recommendation.reason}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-slate-500">
                        Solves: {recommendation.issue}
                      </span>
                      {typeof recommendation.price === "number" ? (
                        <span className="text-[12px] font-semibold text-emerald-200">
                          ${recommendation.price.toFixed(2)}
                        </span>
                      ) : null}
                    </div>
                    {recommendation.replacement ? (
                      <p className="mt-2 text-[11px] text-amber-200/80">
                        Consider replacing: {recommendation.replacement}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function HeaderMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-[112px] rounded-xl border border-white/[0.08] bg-black/35 p-3 backdrop-blur">
      <p className="text-[6px] uppercase tracking-[0.1em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-[10px] font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function ReadinessCheck({
  label,
  ready,
  detail,
}: {
  label: string;
  ready: boolean;
  detail: string;
}) {
  return (
    <div className={[
      "rounded-xl border p-3",
      ready
        ? "border-emerald-300/[0.1] bg-emerald-400/[0.025]"
        : "border-amber-300/[0.11] bg-amber-400/[0.025]",
    ].join(" ")}>
      <div className="flex items-center gap-2">
        {ready ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-300" />
        )}
        <p className="text-[12px] font-semibold text-white">
          {label}
        </p>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function CommandMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "cyan" | "violet" | "emerald" | "amber";
}) {
  const toneClass = {
    cyan: "border-cyan-300/[0.12] bg-cyan-400/[0.035] text-cyan-200",
    violet: "border-violet-300/[0.12] bg-violet-400/[0.035] text-violet-200",
    emerald: "border-emerald-300/[0.12] bg-emerald-400/[0.035] text-emerald-200",
    amber: "border-amber-300/[0.12] bg-amber-400/[0.035] text-amber-200",
  }[tone];

  return (
    <div
      className={[
        "min-w-[132px] rounded-2xl border p-4 backdrop-blur",
        toneClass,
      ].join(" ")}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-70">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">
        {value}
      </p>
      <p className="mt-1 text-[11px] opacity-70">
        {detail}
      </p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.07] bg-[#06131f] p-5">
      <Icon className="h-5 w-5 text-sky-300" />
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">
        {value}
      </p>
      <p className="mt-2 text-[12px] text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/[0.07] bg-[#06131f] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.018)]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/[0.1] bg-cyan-400/[0.035]">
          <Icon className="h-5 w-5 text-sky-300" />
        </div>
        <div>
          <p className="text-[18px] font-semibold text-white">
            {title}
          </p>
          <p className="mt-1 text-[12px] text-slate-500">
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function MetricBars({
  rows,
  max,
}: {
  rows: Array<{
    label: string;
    value: number;
  }>;
  max: number;
}) {
  return (
    <div className="mt-6 space-y-4">
      {rows.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium text-slate-400">
              {item.label}
            </span>
            <span className="font-semibold text-slate-200">
              {item.value} cards
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/[0.045]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-600 to-violet-400"
              style={{
                width: `${Math.min(
                  100,
                  (item.value / max) * 100,
                )}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn";
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-3 text-[8px]">
      <span className="text-slate-600">
        {label}
      </span>
      <span
        className={
          tone === "good"
            ? "text-emerald-300"
            : "text-amber-300"
        }
      >
        {value}
      </span>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.055] bg-black/[0.08] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-100">
        {value}
      </p>
    </div>
  );
}
