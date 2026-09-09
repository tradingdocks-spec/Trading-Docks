"use client";

import {
  type DragEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Columns3,
  Copy,
  Download,
  Eye,
  Grid3X3,
  ImageIcon,
  Layers3,
  List,
  ListCollapse,
  MapPin,
  Move,
  Pencil,
  Plus,
  Redo2,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  Trash2,
  Undo2,
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
  DeckCombo,
  DeckComboReport,
  DeckIntelligenceReport,
  InventoryMatch,
  ManaColor,
  ScryfallCardResult,
} from "@/lib/deck-vault/types";
import { ManaPips } from "./ManaPips";
import { DeckShowcaseStudio as TournamentDeckShowcaseStudio } from "@/components/dashboard-v2/deck-vault/DeckShowcaseStudio";
import {
  deleteDeckRecord,
  saveDeckRecord,
} from "@/lib/deck-vault/persistence";
import {
  exportDeckCsv,
  exportDeckPlainText,
} from "@/lib/deck-suite/domain";
import { isCommanderDeckFormat } from "@/lib/deck-vault/formats";
import { loadInventorySnapshot } from "@/lib/inventory-persistence";
import { DeckPlaytest } from "@/components/deck-vault/DeckPlaytest";
import { DeckmasterPanel } from "./DeckmasterPanel";

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
  W: "bg-td-warning",
  U: "bg-td-accent",
  B: "bg-td-violet",
  R: "bg-td-danger",
  G: "bg-td-success",
  C: "bg-td-raised",
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

type DeckDropSection = "commander" | "main" | "sideboard" | "maybeboard";

type DeckDragPayload =
  | { source: "search"; card: ScryfallCardResult }
  | { source: "deck"; cardId: string };

const DECK_DRAG_MIME = "application/x-trading-docks-deck-card";


function canonicalDeckSection(card: DeckCard) {
  if (card.board === "commander" || card.category === "Commander") {
    return "commander";
  }

  return card.board ?? "main";
}

function combineDuplicateCards(cards: DeckCard[]) {
  const combined = new Map<string, DeckCard>();

  cards.forEach((card) => {
    const quantity = Math.max(0, Number(card.quantity) || 0);
    if (!quantity) return;

    const key = `${canonicalDeckSection(card)}:${card.name.trim().toLocaleLowerCase()}`;
    const existing = combined.get(key);

    if (!existing) {
      combined.set(key, { ...card, quantity });
      return;
    }

    const nextQuantity = existing.quantity + quantity;
    const nextOwnedQuantity =
      (existing.ownedQuantity ?? (existing.owned ? existing.quantity : 0)) +
      (card.ownedQuantity ?? (card.owned ? quantity : 0));

    combined.set(key, {
      ...existing,
      quantity: nextQuantity,
      price:
        (existing.price * existing.quantity + card.price * quantity) /
        nextQuantity,
      ownedQuantity: nextOwnedQuantity,
      owned: nextOwnedQuantity >= nextQuantity,
      inventoryMatches: [
        ...(existing.inventoryMatches ?? []),
        ...(card.inventoryMatches ?? []),
      ],
      image: existing.image || card.image,
      artCrop: existing.artCrop || card.artCrop,
    });
  });

  return Array.from(combined.values());
}


function inferCategoryFromDeckCard(card: DeckCard): DeckCard["category"] {
  const typeLine = `${card.typeLine ?? ""}`.toLowerCase();

  if (typeLine.includes("land")) return "Lands";
  if (typeLine.includes("creature")) return "Creatures";
  if (typeLine.includes("artifact")) return "Artifacts";
  if (typeLine.includes("enchantment")) return "Enchantments";
  if (typeLine.includes("planeswalker")) return "Planeswalkers";
  if (typeLine.includes("instant")) return "Instants";
  if (typeLine.includes("sorcery")) return "Sorceries";

  return "Other";
}


function readExternalCardDrop(dataTransfer: DataTransfer) {
  const uriList = dataTransfer.getData("text/uri-list");
  const plainText = dataTransfer.getData("text/plain");
  const html = dataTransfer.getData("text/html");
  const mozUrl = dataTransfer.getData("text/x-moz-url");

  return {
    uriList,
    plainText,
    html,
    mozUrl,
    hasContent: Boolean(
      uriList.trim() || plainText.trim() || html.trim() || mozUrl.trim(),
    ),
  };
}

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
    () => combineDuplicateCards(deck.cards),
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
  const router = useRouter();
  const [dragging, setDragging] = useState<DeckDragPayload | null>(null);
  const [dropSection, setDropSection] = useState<DeckDropSection | "trash" | null>(null);
  const [undoCard, setUndoCard] = useState<DeckCard | null>(null);
  const [deckActionsOpen, setDeckActionsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deckActionBusy, setDeckActionBusy] = useState(false);
  const [externalDropBusy, setExternalDropBusy] = useState(false);
  const [externalDropError, setExternalDropError] = useState("");
  const [suiteActionStatus, setSuiteActionStatus] = useState("");
  const [deckmasterMobileOpen, setDeckmasterMobileOpen] = useState(false);
  const [deckmasterCollection, setDeckmasterCollection] = useState<
    Array<{ name: string; quantity: number }>
  >([]);

  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState("");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastDeckRef = useRef<DeckRecord>(deck);

  const analytics = useMemo(
    () => deckAnalytics(cards),
    [cards],
  );
  const bracket = useMemo(
    () => evaluateCommanderBracket(cards),
    [cards],
  );
  const isCommander = isCommanderDeckFormat(format);

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

      lastDeckRef.current = updatedDeck;
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
    }, 1200);

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
          setDeckmasterCollection(
            inventory.map((item) => ({
              name: item.name,
              quantity: item.quantity,
            })),
          );

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
      2500,
    );

    return () =>
      window.clearTimeout(timeout);
  }, [format, cards.map((card) => `${card.id}:${card.quantity}:${card.board}`).join("|")]);

  useEffect(() => {
    const warnIfUnsaved = (event: BeforeUnloadEvent) => {
      if (saveState === "saved") return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnIfUnsaved);
    return () => window.removeEventListener("beforeunload", warnIfUnsaved);
  }, [saveState]);

  function retrySave() {
    setSaveState("saving");
    setSaveError("");
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveDeckRecord(lastDeckRef.current))
      .then(() => setSaveState("saved"))
      .catch((error) => {
        setSaveState("error");
        setSaveError(
          error instanceof Error
            ? error.message
            : "Your deck changes could not be saved.",
        );
      });
  }

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

  function cardFromSearch(
    result: ScryfallCardResult,
    section: DeckDropSection = "main",
  ): DeckCard {
    return {
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
      category: section === "commander" ? "Commander" : inferCategory(result),
      price: result.price,
      owned: false,
      image: result.image,
      artCrop: result.artCrop,
      setCode: result.setCode,
      collectorNumber: result.collectorNumber,
      gameChanger: result.gameChanger,
      board: section,
    };
  }

  function replaceCard(
    currentCard: DeckCard,
    replacement: ScryfallCardResult,
  ) {
    const nextCard: DeckCard = {
      ...currentCard,
      id: replacement.id,
      name: replacement.name,
      manaValue: replacement.manaValue,
      colors: replacement.colorIdentity.length
        ? replacement.colorIdentity
        : replacement.colors.length
          ? replacement.colors
          : ["C"],
      typeLine: replacement.typeLine,
      category:
        currentCard.category === "Commander"
          ? "Commander"
          : inferCategory(replacement),
      price: replacement.price,
      owned: false,
      image: replacement.image,
      artCrop: replacement.artCrop,
      setCode: replacement.setCode,
      collectorNumber: replacement.collectorNumber,
      gameChanger: replacement.gameChanger,
      board: currentCard.board,
      quantity: currentCard.quantity,
    };

    setCards((currentCards) =>
      currentCards.map((card) =>
        card.id === currentCard.id
          ? nextCard
          : card,
      ),
    );

    if (
      currentCard.board === "commander" ||
      currentCard.category === "Commander"
    ) {
      setCommanderName(nextCard.name);
      setCommanderImage(nextCard.image ?? "");
      setCommanderArt(nextCard.artCrop ?? "");
    }

    setSaveState("saving");
  }



  function addCard(
    result: ScryfallCardResult,
    section: DeckDropSection = "main",
  ) {
    if (section === "commander") {
      selectCommander(result);
      return;
    }

    setCards((current) => {
      const existing = current.find(
        (card) =>
          canonicalDeckSection(card) === section &&
          card.id === result.id,
      );

      if (existing) {
        return current.map((card) =>
          card.id === existing.id && canonicalDeckSection(card) === section
            ? { ...card, quantity: card.quantity + 1 }
            : card,
        );
      }

      return [...current, cardFromSearch(result, section)];
    });
  }

  function removeCard(id: string) {
    setCards((current) =>
      current
        .map((card) =>
          card.id === id
            ? { ...card, quantity: card.quantity - 1 }
            : card,
        )
        .filter((card) => card.quantity > 0),
    );
  }

  function moveCardToSection(id: string, section: DeckDropSection) {
    setCards((current) => {
      const moving = current.find((card) => card.id === id);
      if (!moving) return current;

      if (section === "commander") {
        const nextCommander = {
          ...moving,
          quantity: 1,
          category: "Commander",
          board: "commander" as const,
        };
        setCommanderName(nextCommander.name);
        setCommanderImage(nextCommander.image ?? "");
        setCommanderArt(nextCommander.artCrop ?? "");
        return [
          nextCommander,
          ...current.filter(
            (card) =>
              card.id !== id &&
              canonicalDeckSection(card) !== "commander",
          ),
        ];
      }

      return current.map((card) =>
        card.id === id
          ? {
              ...card,
              category:
                card.category === "Commander" ? inferCategoryFromDeckCard(card) : card.category,
              board: section,
            }
          : card,
      );
    });
  }
  function trashCardFromDeck(card: DeckCard) {
    setUndoCard({ ...card, quantity: 1 });
    removeCard(card.id);
  }



  function removeDraggedCard(id: string) {
    const card = cards.find((item) => item.id === id);
    if (!card) return;
    setUndoCard({ ...card, quantity: 1 });
    removeCard(id);
    window.setTimeout(() => setUndoCard(null), 5000);
  }

  function undoRemoval() {
    if (!undoCard) return;
    setCards((current) => {
      const existing = current.find(
        (card) =>
          card.id === undoCard.id &&
          canonicalDeckSection(card) === canonicalDeckSection(undoCard),
      );
      if (existing) {
        return current.map((card) =>
          card === existing
            ? { ...card, quantity: card.quantity + 1 }
            : card,
        );
      }
      return [...current, undoCard];
    });
    setUndoCard(null);
  }

  function beginDrag(event: DragEvent, payload: DeckDragPayload) {
    event.dataTransfer.effectAllowed = payload.source === "search" ? "copy" : "move";
    event.dataTransfer.setData(DECK_DRAG_MIME, JSON.stringify(payload));
    setDragging(payload);
  }

  function finishDrag() {
    setDragging(null);
    setDropSection(null);
  }

  async function acceptDrop(
    event: DragEvent,
    target: DeckDropSection | "trash",
  ) {
    event.preventDefault();

    let payload = dragging;
    if (!payload) {
      try {
        const internal = event.dataTransfer.getData(DECK_DRAG_MIME);
        payload = internal
          ? (JSON.parse(internal) as DeckDragPayload)
          : null;
      } catch {
        payload = null;
      }
    }

    if (payload) {
      if (target === "trash") {
        if (payload.source === "deck") removeDraggedCard(payload.cardId);
        finishDrag();
        return;
      }

      if (payload.source === "search") addCard(payload.card, target);
      else moveCardToSection(payload.cardId, target);
      finishDrag();
      return;
    }

    if (target === "trash") {
      finishDrag();
      return;
    }

    const externalPayload = readExternalCardDrop(event.dataTransfer);
    if (!externalPayload.hasContent) {
      setExternalDropError(
        "This drag did not include a card link, image URL, or card name. Open the card page on Scryfall or EDHREC and drag the card image or link again.",
      );
      finishDrag();
      return;
    }

    setExternalDropBusy(true);
    setExternalDropError("");

    try {
      const response = await fetch("/api/deck-vault/external-card-resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(externalPayload),
      });
      const result = (await response.json()) as {
        card?: ScryfallCardResult;
        error?: string;
      };

      if (!response.ok || !result.card) {
        throw new Error(
          result.error || "Trading Docks could not identify that card.",
        );
      }

      addCard(result.card, target);
    } catch (reason) {
      setExternalDropError(
        reason instanceof Error
          ? reason.message
          : "Trading Docks could not identify that external card.",
      );
    } finally {
      setExternalDropBusy(false);
      finishDrag();
    }
  }

  async function emptyDeck() {
    setDeckActionBusy(true);
    setCards([]);
    setCommanderName("");
    setCommanderImage("");
    setCommanderArt("");
    setDeckActionsOpen(false);
    setDeckActionBusy(false);
  }

  async function archiveDeck() {
    setDeckActionBusy(true);
    await saveDeckRecord({
      ...deck,
      name: deckName,
      commander: commanderName || undefined,
      cards,
      status: "Wishlist",
      updatedAt: new Date().toISOString(),
    });
    setDeckActionsOpen(false);
    setDeckActionBusy(false);
    router.push("/dashboard/deck-vault");
  }

  async function permanentlyDeleteDeck() {
    if (deleteConfirm.trim().toLowerCase() !== deckName.trim().toLowerCase()) return;
    setDeckActionBusy(true);
    // Drain any debounced/autosaved edits before deleting. Otherwise an edit
    // already queued on this page can finish after the delete and recreate it.
    await saveQueueRef.current.catch(() => undefined);
    await deleteDeckRecord(deck.id);
    router.push("/dashboard/deck-vault");
  }

  async function copyDeckText() {
    const text = exportDeckPlainText(lastDeckRef.current);
    try {
      await navigator.clipboard.writeText(text);
      setSuiteActionStatus("Decklist copied.");
    } catch {
      setSuiteActionStatus("Clipboard unavailable. Use CSV export instead.");
    }
  }

  function downloadDeckCsv() {
    const blob = new Blob([exportDeckCsv(lastDeckRef.current)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${deckName.trim() || "deck"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setSuiteActionStatus("CSV export downloaded.");
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
    <main className="min-h-screen bg-td-canvas px-5 py-7 text-td-primary sm:px-8 lg:px-10">
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
              ? "border-td-danger/20 bg-td-danger/10 text-td-danger"
              : "border-td-ink/[0.06] bg-td-surface text-td-secondary",
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
          {saveState === "error" ? (
            <button
              type="button"
              onClick={retrySave}
              className="ml-4 shrink-0 rounded-lg border border-td-danger/20 bg-td-danger/10 px-3 py-1.5 font-semibold text-td-danger transition hover:bg-td-danger/15"
            >
              Retry save
            </button>
          ) : null}
          {saveState === "saved" ? <CheckCircle2 className="h-4 w-4 text-td-success" /> : null}
        </div>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0">
            <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-td-ink/[0.06] bg-td-surface p-2">
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
                "h-10 rounded-xl px-4 text-[11px] font-semibold transition",
                tab === item
                  ? "bg-td-accent text-td-on-accent"
                  : "text-td-muted hover:bg-td-ink/[0.025] hover:text-td-secondary",
              ].join(" ")}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="mt-3 flex justify-end">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeckmasterMobileOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-td-accent px-4 text-xs font-semibold text-td-on-accent transition hover:bg-td-accent-hover"
            >
              <BrainCircuit className="h-4 w-4" />
              Open Deckmaster
            </button>
            <button
              type="button"
              onClick={() => void copyDeckText()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-td-ink/[0.08] bg-td-ink/[0.025] px-4 text-xs font-semibold text-td-primary transition hover:bg-td-ink/[0.05]"
            >
              <Copy className="h-4 w-4" />
              Copy list
            </button>
            <button
              type="button"
              onClick={downloadDeckCsv}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-td-ink/[0.08] bg-td-ink/[0.025] px-4 text-xs font-semibold text-td-primary transition hover:bg-td-ink/[0.05]"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => setDeckActionsOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-td-danger/[0.14] bg-td-danger/[0.045] px-4 text-xs font-semibold text-td-danger transition hover:bg-td-danger/[0.08]"
            >
              <Trash2 className="h-4 w-4" />
              Tear apart or archive deck
            </button>
          </div>
        </div>
        {suiteActionStatus ? (
          <p className="mt-2 text-right text-xs text-td-muted" role="status">{suiteActionStatus}</p>
        ) : null}

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
            replaceCard={replaceCard}
            removeCard={removeCard}
            trashCardFromDeck={trashCardFromDeck}
            beginDrag={beginDrag}
            finishDrag={finishDrag}
            acceptDrop={acceptDrop}
            dragging={dragging}
            dropSection={dropSection}
            setDropSection={setDropSection}
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
            externalDropBusy={externalDropBusy}
            externalDropError={externalDropError}
            clearExternalDropError={() => setExternalDropError("")}
          />
        ) : tab === "Intelligence" ? (
          <IntelligenceWorkspace
            report={intelligence}
            loading={intelligenceLoading}
            format={format}
            cards={cards}
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
        ) : tab === "Playtest" ? (
          <DeckPlaytest cards={cards} commanderName={commanderName} />
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
          </section>
          <DeckmasterPanel
            deck={{ ...deck, name: deckName, commander: commanderName || undefined, format, cards }}
            collection={deckmasterCollection}
            mobileOpen={deckmasterMobileOpen}
            onMobileClose={() => setDeckmasterMobileOpen(false)}
            onApply={(nextDeck) => {
              setCards(nextDeck.cards);
              setCommanderName(nextDeck.commander ?? "");
              setDeckmasterMobileOpen(false);
              setSaveState("saving");
            }}
          />
        </div>
      </div>

      {dragging ? (
        <div
          onDragOver={(event) => { event.preventDefault(); setDropSection("trash"); }}
          onDragLeave={() => setDropSection(null)}
          onDrop={(event) => acceptDrop(event, "trash")}
          className={[
            "fixed inset-x-4 bottom-4 z-[120] flex min-h-[78px] items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-5 text-sm font-semibold shadow-[0_24px_80px_rgb(var(--td-shadow-rgb)/calc(.55*var(--td-shadow-strength)))] transition",
            dropSection === "trash"
              ? "border-td-danger bg-td-danger/20 text-td-danger scale-[1.01]"
              : "border-td-danger/30 bg-td-surface/95 text-td-danger",
          ].join(" ")}
        >
          <Trash2 className="h-5 w-5" />
          Drop here to remove one copy from this deck · Inventory stays safe
        </div>
      ) : null}

      {undoCard ? (
        <div className="fixed bottom-5 left-1/2 z-[130] flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-td-ink/[0.1] bg-td-surface px-4 py-3 text-sm shadow-[0_24px_80px_rgb(var(--td-shadow-rgb)/calc(.55*var(--td-shadow-strength)))]">
          <span className="text-td-secondary">Removed {undoCard.name}</span>
          <button type="button" onClick={undoRemoval} className="font-semibold text-td-accent-text">Undo</button>
        </div>
      ) : null}

      {deckActionsOpen ? (
        <div className="fixed inset-0 z-[140] grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
          <section className="w-full max-w-2xl rounded-[28px] border border-td-danger/[0.16] bg-td-surface p-6 shadow-[0_35px_120px_rgb(var(--td-shadow-rgb)/calc(.7*var(--td-shadow-strength)))]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-td-danger">Deck lifecycle</p>
                <h2 className="mt-2 text-2xl font-semibold text-td-primary">Tear apart, archive, or delete</h2>
                <p className="mt-3 text-sm leading-7 text-td-muted">These actions affect the decklist only. Owned Inventory records are never deleted.</p>
              </div>
              <button type="button" onClick={() => setDeckActionsOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-td-ink/[0.08] text-td-muted"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <button disabled={deckActionBusy} onClick={() => void emptyDeck()} className="rounded-2xl border border-td-ink/[0.08] bg-td-ink/[0.025] p-4 text-left hover:border-td-accent/[0.2]">
                <p className="text-sm font-semibold text-td-primary">Empty decklist</p>
                <p className="mt-2 text-xs leading-5 text-td-muted">Keep the deck shell and remove every card.</p>
              </button>
              <button disabled={deckActionBusy} onClick={() => void archiveDeck()} className="rounded-2xl border border-td-warning/[0.12] bg-td-warning/[0.035] p-4 text-left">
                <p className="text-sm font-semibold text-td-warning">Archive deck</p>
                <p className="mt-2 text-xs leading-5 text-td-muted">Preserve the complete list and return to Deck Vault.</p>
              </button>
              <div className="rounded-2xl border border-td-danger/[0.14] bg-td-danger/[0.035] p-4">
                <p className="text-sm font-semibold text-td-danger">Delete permanently</p>
                <p className="mt-2 text-xs leading-5 text-td-muted">Type the deck name to confirm.</p>
                <input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder={deckName} className="mt-3 h-10 w-full rounded-xl border border-td-ink/[0.08] bg-black/20 px-3 text-xs text-td-primary outline-none" />
                <button disabled={deckActionBusy || deleteConfirm.trim().toLowerCase() !== deckName.trim().toLowerCase()} onClick={() => void permanentlyDeleteDeck()} className="mt-3 h-10 w-full rounded-xl bg-td-danger text-xs font-semibold text-td-primary disabled:opacity-35">Delete deck</button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
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
      <header className="relative min-h-[300px] overflow-hidden rounded-[30px] border border-td-accent/[0.12] bg-td-surface">
        {commanderArt && isCommander ? (
          <>
            <img
              src={commanderArt}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center opacity-55"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-td-canvas via-td-canvas/90 to-td-canvas/15" />
            <div className="absolute inset-0 bg-gradient-to-t from-td-canvas via-transparent to-black/15" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgb(var(--td-accent-rgb)/0.15),transparent_35%),radial-gradient(circle_at_35%_85%,rgba(139,92,246,0.12),transparent_38%)]" />
        )}

        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-td-warning via-td-accent via-td-violet via-td-danger to-td-success opacity-80" />

        <div className="relative flex min-h-[300px] flex-col justify-end gap-6 p-6 sm:p-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-end gap-5">
            {commanderImage && isCommander ? (
              <img
                src={commanderImage}
                alt={commanderName || "Commander"}
                className="hidden h-[184px] w-[132px] rounded-2xl border border-td-ink/[0.12] object-cover shadow-2xl sm:block"
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
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text">
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
                  }} className="h-14 min-w-0 flex-1 rounded-xl border border-td-accent/30 bg-td-surface/90 px-4 text-2xl font-semibold text-td-primary outline-none sm:text-3xl" />
                  <button type="button" onClick={commitName} className="flex h-12 items-center rounded-xl bg-td-accent px-4 text-sm font-semibold text-td-on-accent">Save</button>
                  <button type="button" onClick={() => {
                    setDraftName(deckName);
                    setEditingName(false);
                  }} className="flex h-12 w-12 items-center justify-center rounded-xl border border-td-ink/10 text-td-secondary" aria-label="Cancel rename"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">
                    {deckName}
                  </h1>
                  <button type="button" onClick={() => {
                    setDraftName(deckName);
                    setEditingName(true);
                  }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-td-ink/10 bg-black/20 text-td-secondary transition hover:border-td-accent/30 hover:text-td-accent-text" aria-label="Rename deck" title="Rename deck">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              )}
              <p className="mt-3 text-sm text-td-secondary">
                {isCommander && commanderName
                  ? `Commander: ${commanderName}`
                  : `${format} constructed deck`}
              </p>

              {isCommander ? (
                <button
                  type="button"
                  onClick={() => setCommanderPickerOpen(true)}
                  className="mt-4 h-10 rounded-xl border border-td-accent/[0.18] bg-td-accent/[0.045] px-4 text-[11px] font-semibold text-td-accent-text transition hover:border-td-accent/40 hover:bg-td-accent/[0.08]"
                >
                  Change Commander
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-muted">
                View as format
              </span>
              <select
                value={format}
                onChange={(event) =>
                  setFormat(
                    event.target.value as DeckFormat,
                  )
                }
                className="mt-2 h-11 w-full min-w-[190px] rounded-xl border border-td-ink/[0.1] bg-td-surface/90 px-3 text-[11px] font-semibold text-td-primary outline-none backdrop-blur"
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
          <section className="max-h-[82vh] w-full max-w-3xl overflow-hidden rounded-[26px] border border-td-accent/[0.16] bg-td-surface shadow-[0_30px_100px_rgb(var(--td-shadow-rgb)/calc(0.65*var(--td-shadow-strength)))]">
            <div className="flex items-center justify-between border-b border-td-ink/[0.06] p-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-td-accent-text">
                  Change Commander
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  Choose a legendary commander
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCommanderPickerOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-td-ink/[0.07] text-td-muted hover:text-td-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              <label className="flex h-12 items-center gap-3 rounded-xl border border-td-ink/[0.08] bg-black/[0.14] px-4">
                <Search className="h-4 w-4 text-td-muted" />
                <input
                  value={commanderQuery}
                  onChange={(event) =>
                    setCommanderQuery(event.target.value)
                  }
                  placeholder="Search commanders..."
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-td-primary outline-none placeholder:text-td-muted"
                />
              </label>

              <div className="mt-4 grid max-h-[56vh] gap-3 overflow-y-auto sm:grid-cols-2">
                {commanderResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => selectCommander(result)}
                    className="flex items-center gap-3 rounded-2xl border border-td-ink/[0.06] bg-td-ink/[0.015] p-3 text-left transition hover:border-td-accent/[0.18] hover:bg-td-accent/[0.025]"
                  >
                    {result.image ? (
                      <img
                        src={result.image}
                        alt={result.name}
                        className="h-24 w-[68px] rounded-xl object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-td-primary">
                        {result.name}
                      </p>
                      <p className="mt-1 text-[11px] text-td-muted">
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
                    <Check className="h-4 w-4 shrink-0 text-td-accent-text" />
                  </button>
                ))}

                {commanderSearching ? (
                  <p className="col-span-full py-10 text-center text-[11px] text-td-muted">
                    Searching commanders...
                  </p>
                ) : null}

                {!commanderSearching &&
                commanderQuery.trim().length >= 2 &&
                !commanderResults.length ? (
                  <p className="col-span-full py-10 text-center text-[11px] text-td-muted">
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
  | "condensed"
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
  replaceCard,
  removeCard,
  trashCardFromDeck,
  beginDrag,
  finishDrag,
  acceptDrop,
  dragging,
  dropSection,
  setDropSection,
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
  externalDropBusy,
  externalDropError,
  clearExternalDropError,
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
  addCard: (card: ScryfallCardResult, section?: DeckDropSection) => void;
  replaceCard: (currentCard: DeckCard, replacement: ScryfallCardResult) => void;
  removeCard: (id: string) => void;
  trashCardFromDeck: (card: DeckCard) => void;
  beginDrag: (event: DragEvent, payload: DeckDragPayload) => void;
  finishDrag: () => void;
  acceptDrop: (event: DragEvent, target: DeckDropSection | "trash") => Promise<void>;
  dragging: DeckDragPayload | null;
  dropSection: DeckDropSection | "trash" | null;
  setDropSection: (section: DeckDropSection | "trash" | null) => void;
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
  externalDropBusy: boolean;
  externalDropError: string;
  clearExternalDropError: () => void;
}) {
  const [selectedCardId, setSelectedCardId] =
    useState<string | null>(
      mainDeckCards[0]?.id ?? null,
    );
  const [hoveredCardId, setHoveredCardId] =
    useState<string | null>(null);
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
  const [replacementCard, setReplacementCard] =
    useState<DeckCard | null>(null);
  const deckColors = useMemo(
    () =>
      Array.from(
        new Set(
          (commanderCard ? commanderCard.colors : mainDeckCards.flatMap((card) => card.colors))
            .filter((color): color is Exclude<ManaColor, "C"> => color !== "C"),
        ),
      ),
    [commanderCard, mainDeckCards],
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
    isCommanderDeckFormat(format);
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
    ) ?? null;
  const hoveredCard =
    mainDeckCards.find(
      (card) => card.id === hoveredCardId,
    ) ?? null;
  const inspectorCard =
    hoveredCard ??
    selectedCard ??
    filteredCards[0] ??
    mainDeckCards[0];
  const inspectorLocked =
    Boolean(
      inspectorCard &&
        selectedCard?.id === inspectorCard.id &&
        (!hoveredCard || hoveredCard.id === selectedCard.id),
    );

  function previewCard(id: string) {
    setHoveredCardId(id);
  }

  function clearCardPreview(id?: string) {
    setHoveredCardId((current) =>
      id && current !== id ? current : null,
    );
  }

  function selectCard(id: string) {
    setSelectedCardId(id);
    setHoveredCardId(null);
  }

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
    <section className="mt-5 overflow-hidden rounded-[28px] border border-td-accent/[0.085] bg-[radial-gradient(circle_at_top_left,rgb(var(--td-accent-rgb)/.055),transparent_26%),linear-gradient(180deg,var(--td-surface-default)_0%,var(--td-surface-default)_100%)] shadow-[0_42px_140px_rgb(var(--td-shadow-rgb)/calc(.48*var(--td-shadow-strength)))]">
      <section className="sticky top-0 z-40 overflow-visible border-b border-td-accent/[0.10] bg-td-surface/98 shadow-[0_16px_48px_rgb(var(--td-shadow-rgb)/calc(.34*var(--td-shadow-strength)))] backdrop-blur-2xl">
        <div className="flex flex-col gap-4 border-b border-td-ink/[0.055] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-td-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-td-success shadow-[0_0_12px_rgb(var(--td-accent-rgb)/.65)]" />
              Live workspace
              <span className="text-td-on-accent">/</span>
              Autosaved
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[20px] font-black uppercase tracking-[-0.035em] text-td-primary">
                Deck <span className="text-td-accent-text">Studio</span>
              </p>
              <span className="rounded-full border border-td-accent/[0.14] bg-td-accent/[0.045] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.13em] text-td-accent-text">
                Build mode
              </span>
            </div>
            <p className="mt-2 text-[13px] text-td-muted">
              Add cards, organize sections, and inspect every choice without leaving the builder.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowcaseOpen(true)}
              className="flex h-10 items-center gap-2 rounded-xl border border-td-accent/30 bg-gradient-to-r from-td-accent to-td-accent px-4 text-[12px] font-bold text-td-on-accent shadow-[0_0_30px_rgb(var(--td-accent-rgb)/0.14)] transition hover:brightness-110"
            >
              <Share2 className="h-4 w-4" />
              Share Deck
            </button>
            <details className="group/view relative">
              <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-td-accent/20 bg-td-accent/[0.06] px-3.5 text-[12px] font-semibold text-td-accent-text transition hover:border-td-accent/35 [&::-webkit-details-marker]:hidden">
                <Eye className="h-4 w-4" />
                View
                <span className="hidden text-td-secondary sm:inline">
                  · {view === "table" ? "Text" : view === "condensed" ? "Condensed" : view === "grid" ? "Visual Grid" : view === "stats" ? "Analytics" : view.charAt(0).toUpperCase() + view.slice(1)}
                </span>
                <ChevronDown className="h-3.5 w-3.5 transition group-open/view:rotate-180" />
              </summary>
              <div className="absolute right-0 z-50 mt-2 grid max-h-[min(28rem,calc(100vh-7rem))] w-52 gap-1 overflow-y-auto overscroll-contain rounded-2xl border border-td-ink/[0.09] bg-td-surface/98 p-2 shadow-[0_24px_70px_rgb(var(--td-shadow-rgb)/calc(0.55*var(--td-shadow-strength)))] backdrop-blur-xl [scrollbar-color:rgb(var(--td-accent-rgb)/.35)_transparent]">
                {[
                  { value: "table" as const, label: "Text", icon: List },
                  { value: "condensed" as const, label: "Condensed", icon: ListCollapse },
                  { value: "columns" as const, label: "Columns", icon: Columns3 },
                  { value: "grid" as const, label: "Visual Grid", icon: Grid3X3 },
                  { value: "stacks" as const, label: "Stacks", icon: Layers3 },
                  { value: "role" as const, label: "Role", icon: ImageIcon },
                  { value: "stats" as const, label: "Analytics", icon: BarChart3 },
                ].map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={(event) => {
                        setView(mode.value);
                        if (mode.value === "role") setGrouping("role");
                        event.currentTarget.closest("details")?.removeAttribute("open");
                      }}
                      className={[
                        "flex h-10 items-center gap-3 rounded-xl px-3 text-left text-[12px] font-semibold transition",
                        view === mode.value
                          ? "bg-td-accent text-td-on-accent"
                          : "text-td-secondary hover:bg-td-ink/[0.045] hover:text-td-accent-text",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" />
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </details>
          </div>
        </div>

        
        <div className="grid grid-cols-2 gap-px border-t border-td-ink/[0.045] bg-td-ink/[0.035] sm:grid-cols-5">
          <div className="bg-td-surface px-4 py-3 transition hover:bg-td-accent/[0.025]">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-td-muted">Cards</p>
            <p className="mt-1 text-[13px] font-semibold text-td-primary">{mainDeckCount}/100</p>
          </div>
          <div className="bg-td-surface px-4 py-3 transition hover:bg-td-accent/[0.025]">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-td-muted">Unique</p>
            <p className="mt-1 text-[13px] font-semibold text-td-primary">{uniqueCardCount}</p>
          </div>
          <div className="bg-td-surface px-4 py-3 transition hover:bg-td-accent/[0.025]">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-td-muted">Missing</p>
            <p className="mt-1 text-[13px] font-semibold text-td-warning">{missing}</p>
          </div>
          <div className="bg-td-surface px-4 py-3 transition hover:bg-td-accent/[0.025]">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-td-muted">Est. Value</p>
            <p className="mt-1 text-[13px] font-semibold text-td-accent-text">${mainDeckValue.toFixed(2)}</p>
          </div>
          <div className="bg-td-surface px-4 py-3 transition hover:bg-td-accent/[0.025]">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-td-muted">Power Level</p>
            <p className="mt-1 text-[13px] font-semibold text-td-primary">7–8</p>
          </div>
        </div>

        <div className="grid gap-3 border-t border-td-ink/[0.045] bg-black/[0.08] px-5 py-4 lg:grid-cols-[minmax(320px,1fr)_180px_170px_auto]">
          <label className="flex h-11 items-center gap-3 rounded-xl border border-td-ink/[0.075] bg-black/[0.15] px-3">
            <Search className="h-4 w-4 text-td-muted" />
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search cards, sets, or roles..."
              className="min-w-0 flex-1 bg-transparent text-[13px] text-td-primary outline-none placeholder:text-td-muted"
            />
          </label>

          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value)
            }
            className="h-11 rounded-xl border border-td-ink/[0.075] bg-td-surface px-3 text-[12px] text-td-secondary outline-none"
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
            className="h-11 rounded-xl border border-td-ink/[0.075] bg-td-surface px-3 text-[12px] text-td-secondary outline-none"
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
              className="h-11 rounded-xl border border-td-violet/[0.15] bg-td-violet/[0.035] px-4 text-[12px] font-semibold text-td-violet"
            >
              Change Commander
            </button> : null}
            {selectedIds.length ? (
              <button
                type="button"
                onClick={removeSelected}
                className="h-11 rounded-xl border border-td-danger/[0.15] bg-td-danger/[0.04] px-4 text-[12px] font-semibold text-td-danger"
              >
                Delete {selectedIds.length}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-0 xl:grid-cols-[255px_minmax(0,1fr)_345px]">
        <aside className="space-y-4 border-r border-td-accent/[0.055] bg-td-surface/82 p-4 xl:self-start">
          {isCommander && commanderCard ? (
            <section className="overflow-hidden rounded-[20px] border border-td-violet/[0.14] bg-[radial-gradient(circle_at_top,rgba(139,92,246,.13),transparent_46%),var(--td-surface-default)] shadow-[0_22px_65px_rgb(var(--td-shadow-rgb)/calc(.34*var(--td-shadow-strength)))]">
              <div className="border-b border-td-ink/[0.055] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-td-violet">
                  Commander
                </p>
              </div>

              <div className="p-4">
                <div className="mx-auto w-full max-w-[190px] overflow-hidden rounded-[18px] border border-td-ink/[0.1] bg-black/30 shadow-[0_18px_50px_rgb(var(--td-shadow-rgb)/calc(0.38*var(--td-shadow-strength))),0_0_24px_rgba(139,92,246,0.10)]">
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

                <p className="mt-4 text-center text-[15px] font-semibold leading-5 tracking-[-0.01em] text-td-primary">
                  {commanderCard.name}
                </p>

                <div className="mt-3 flex items-center justify-center">
                  <ManaSymbols
                    colors={commanderCard.colors}
                    size="sm"
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-td-ink/[0.06] bg-black/[0.16] px-3 py-2.5 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-td-muted">Deck value</p>
                    <p className="mt-1 text-[12px] font-semibold text-td-success">${mainDeckValue.toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl border border-td-ink/[0.06] bg-black/[0.16] px-3 py-2.5 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-td-muted">Owned</p>
                    <p className="mt-1 text-[12px] font-semibold text-td-primary">{mainDeckCount ? Math.round((owned / mainDeckCount) * 100) : 0}%</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setCommanderPickerOpen(true)
                  }
                  className="mt-4 h-10 w-full rounded-xl border border-td-violet/[0.14] bg-td-violet/[0.04] text-[12px] font-semibold text-td-violet transition hover:border-td-violet/30 hover:bg-td-violet/[0.07]"
                >
                  Change Commander
                </button>
              </div>
            </section>
          ) : null}

          <section className="rounded-[22px] border border-td-ink/[0.065] bg-td-surface p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-td-muted">
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

          <section className="rounded-[22px] border border-td-ink/[0.065] bg-td-surface p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-td-muted">
              Quick Add
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
                  className="flex min-w-0 items-center gap-2 rounded-xl border border-td-ink/[0.06] bg-td-ink/[0.012] px-2.5 py-2 text-[11px] text-td-secondary transition hover:border-td-accent/[0.14] hover:text-td-accent-text"
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

        <main className="min-w-0 bg-[radial-gradient(circle_at_top,rgb(var(--td-accent-rgb)/.045),transparent_30%),var(--td-surface-default)] p-3.5 sm:p-4">
          <section className="mb-4 overflow-hidden rounded-[22px] border border-td-accent/[0.14] bg-[radial-gradient(circle_at_top_left,rgb(var(--td-accent-rgb)/.085),transparent_34%),linear-gradient(135deg,var(--td-surface-default),var(--td-surface-default))] p-4 shadow-[0_22px_70px_rgb(var(--td-shadow-rgb)/calc(.26*var(--td-shadow-strength)))]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-td-accent shadow-[0_0_14px_rgb(var(--td-accent-rgb)/.7)]" /><p className="text-[14px] font-semibold tracking-[-0.01em] text-td-primary">Deck Construction Canvas</p></div>
                <p className="mt-1 text-[11px] text-td-muted">Drag cards from Trading Docks, Scryfall, or EDHREC. Every change saves automatically.</p>
              </div>
              <span className="rounded-full border border-td-success/[0.12] bg-td-success/[0.04] px-3 py-1.5 text-[11px] font-semibold text-td-success">{externalDropBusy ? "Resolving external card…" : "Autosaves to your account"}</span>
            </div>

            {externalDropError ? (
              <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-td-warning/[0.16] bg-td-warning/[0.055] px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-td-warning">External card could not be added</p>
                  <p className="mt-1 text-[11px] leading-5 text-td-warning/55">{externalDropError}</p>
                </div>
                <button
                  type="button"
                  onClick={clearExternalDropError}
                  className="shrink-0 rounded-lg border border-td-warning/[0.12] px-2 py-1 text-[11px] font-semibold text-td-warning/70"
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {([
                {
                  section: "commander",
                  label: "Commander",
                  count: cards.filter((card) => canonicalDeckSection(card) === "commander").reduce((sum, card) => sum + card.quantity, 0),
                  idle: "border-td-violet/[0.18] bg-td-violet/[0.045] hover:border-td-violet/40 hover:bg-td-violet/[0.08]",
                  active: "scale-[1.015] border-td-violet/80 bg-td-violet/[0.14] shadow-[0_0_42px_rgba(167,139,250,.22)]",
                  accent: "text-td-violet",
                  dot: "bg-td-violet shadow-[0_0_12px_rgba(196,181,253,.65)]",
                },
                {
                  section: "main",
                  label: "Main Deck",
                  count: cards.filter((card) => canonicalDeckSection(card) === "main").reduce((sum, card) => sum + card.quantity, 0),
                  idle: "border-td-accent/[0.18] bg-td-accent/[0.045] hover:border-td-accent/40 hover:bg-td-accent/[0.08]",
                  active: "scale-[1.015] border-td-accent/80 bg-td-accent/[0.14] shadow-[0_0_42px_rgb(var(--td-accent-rgb)/.22)]",
                  accent: "text-td-accent-text",
                  dot: "bg-td-accent shadow-[0_0_12px_rgb(var(--td-accent-rgb)/.65)]",
                },
                {
                  section: "sideboard",
                  label: "Sideboard",
                  count: cards.filter((card) => canonicalDeckSection(card) === "sideboard").reduce((sum, card) => sum + card.quantity, 0),
                  idle: "border-td-warning/[0.18] bg-td-warning/[0.04] hover:border-td-warning/40 hover:bg-td-warning/[0.075]",
                  active: "scale-[1.015] border-td-warning/80 bg-td-warning/[0.13] shadow-[0_0_42px_rgba(252,211,77,.20)]",
                  accent: "text-td-warning",
                  dot: "bg-td-warning shadow-[0_0_12px_rgba(252,211,77,.6)]",
                },
                {
                  section: "maybeboard",
                  label: "Considering",
                  count: cards.filter((card) => canonicalDeckSection(card) === "maybeboard").reduce((sum, card) => sum + card.quantity, 0),
                  idle: "border-td-success/[0.18] bg-td-success/[0.04] hover:border-td-success/40 hover:bg-td-success/[0.075]",
                  active: "scale-[1.015] border-td-success/80 bg-td-success/[0.13] shadow-[0_0_42px_rgb(var(--td-accent-rgb)/.20)]",
                  accent: "text-td-success",
                  dot: "bg-td-success shadow-[0_0_12px_rgb(var(--td-accent-rgb)/.6)]",
                },
              ] as Array<{
                section: DeckDropSection;
                label: string;
                count: number;
                idle: string;
                active: string;
                accent: string;
                dot: string;
              }>).map((destination) => (
                <div
                  key={destination.section}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropSection(destination.section);
                  }}
                  onDragLeave={() => setDropSection(null)}
                  onDrop={(event) => acceptDrop(event, destination.section)}
                  className={[
                    "group rounded-[16px] border px-4 py-3.5 transition duration-200",
                    dropSection === destination.section ? destination.active : destination.idle,
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={["h-2 w-2 rounded-full", destination.dot].join(" ")} />
                      <p className={["text-xs font-semibold", destination.accent].join(" ")}>{destination.label}</p>
                    </div>
                    <span className={["text-xs font-bold", destination.accent].join(" ")}>{destination.count}</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-td-muted">Drop cards here</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {cards.slice(0, 20).map((card) => (
                <button
                  key={`${card.id}-${canonicalDeckSection(card)}`}
                  type="button"
                  draggable
                  onDragStart={(event) => beginDrag(event, { source: "deck", cardId: card.id })}
                  onDragEnd={finishDrag}
                  className="flex min-w-[170px] items-center gap-2 rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.02] p-2 text-left transition hover:border-td-accent/[0.18]"
                >
                  {card.image ? <img src={card.image} alt="" className="h-12 w-9 rounded-md object-cover" /> : null}
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold text-td-primary">{card.quantity}× {card.name}</span>
                    <span className="mt-1 block text-[11px] capitalize text-td-muted">{canonicalDeckSection(card)}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {searchResults.length ? (
            <section className="mb-4 rounded-[22px] border border-td-accent/[0.11] bg-td-surface p-4">
              <p className="text-[12px] font-semibold text-td-accent-text">
                Add cards
              </p>
              <div className="mt-3 grid max-h-[260px] gap-2 overflow-y-auto sm:grid-cols-2">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    draggable
                    onDragStart={(event) => beginDrag(event, { source: "search", card: result })}
                    onDragEnd={finishDrag}
                    className="rounded-xl border border-td-ink/[0.055] bg-td-ink/[0.015] p-2 transition hover:border-td-accent/[0.16]"
                  >
                    <div className="flex items-center gap-3">
                      {result.image ? (
                        <img
                          src={result.image}
                          alt={result.name}
                          className="h-16 w-12 rounded-lg object-cover"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-td-primary">
                          {result.name}
                        </p>
                        <p className="mt-1 text-[11px] text-td-muted">
                          {result.setName} · ${result.price.toFixed(2)}
                        </p>
                        <p className="mt-1 text-[11px] text-td-muted">Drag to a section or tap below</p>
                      </div>
                      <Plus className="h-4 w-4 text-td-accent-text" />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {([
                        ["main", "Main", "border-td-accent/[0.16] bg-td-accent/[0.035] text-td-accent-text hover:bg-td-accent/[0.08]"],
                        ["sideboard", "Sideboard", "border-td-warning/[0.16] bg-td-warning/[0.03] text-td-warning hover:bg-td-warning/[0.075]"],
                        ["maybeboard", "Considering", "border-td-success/[0.16] bg-td-success/[0.03] text-td-success hover:bg-td-success/[0.075]"],
                        ["commander", "Commander", "border-td-violet/[0.16] bg-td-violet/[0.035] text-td-violet hover:bg-td-violet/[0.08]"],
                      ] as Array<[DeckDropSection, string, string]>).map(([section, label, tone]) => (
                        <button
                          key={section}
                          type="button"
                          onClick={() => addCard(result, section)}
                          className={["h-8 rounded-lg border px-2 text-[11px] font-semibold transition", tone].join(" ")}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : searching ? (
            <p className="mb-4 rounded-xl border border-td-ink/[0.05] bg-td-surface p-4 text-[12px] text-td-muted">
              Searching Scryfall...
            </p>
          ) : null}

          {view === "table" ? (
            <section className="overflow-hidden rounded-[24px] border border-td-ink/[0.07] bg-td-surface">
              <div className="flex items-center justify-between border-b border-td-ink/[0.055] px-5 py-4">
                <div>
                  <p className="text-[17px] font-semibold text-td-primary">
                    Deck Canvas
                  </p>
                  <p className="mt-1 text-[12px] text-td-muted">
                    {filteredCards.length} cards shown · hover to preview · click to edit
                  </p>
                </div>
                <span className="text-[12px] text-td-muted">
                  {owned} owned · {missing} missing
                </span>
              </div>

              <div className="max-h-[calc(100vh-300px)] overflow-y-auto overflow-x-hidden">
                <table className="w-full table-fixed border-collapse text-left">
                  <thead className="sticky top-0 z-20 bg-td-surface shadow-[0_1px_0_rgb(var(--td-ink-rgb)/0.07)]">
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
                      <th className="w-[46%] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-td-muted">
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
                      <th className="w-28 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-td-muted">
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
                        previewing={
                          hoveredCard?.id ===
                          card.id
                        }
                        onCheck={() =>
                          toggleSelected(card.id)
                        }
                        onSelect={() =>
                          selectCard(card.id)
                        }
                        onPreview={() =>
                          previewCard(card.id)
                        }
                        onPreviewEnd={() =>
                          clearCardPreview(card.id)
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {view === "condensed" ? (
            <DeckCondensedView
              cards={filteredCards}
              selectedCardId={selectedCardId}
              previewCardId={hoveredCardId}
              onSelect={selectCard}
              onPreview={previewCard}
              onPreviewEnd={clearCardPreview}
              onTrash={trashCardFromDeck}
            />
          ) : null}

          {view === "grid" ? (
            <section className="rounded-[24px] border border-td-ink/[0.07] bg-td-surface p-5">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
                {filteredCards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() =>
                      selectCard(card.id)
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
              onSelect={selectCard}
            />
          ) : null}

          {view === "stacks" ? (
            <DeckStacksView
              cards={filteredCards}
              onSelect={selectCard}
            />
          ) : null}

          {view === "role" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {roleGroups.map((group) => (
                <section
                  key={group.role}
                  className="rounded-[22px] border border-td-ink/[0.065] bg-td-surface p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[16px] font-semibold text-td-primary">
                        {group.role}
                      </p>
                      <p className="mt-1 text-[11px] text-td-muted">
                        {group.cards.reduce(
                          (sum, card) =>
                            sum + card.quantity,
                          0,
                        )}{" "}
                        cards
                      </p>
                    </div>
                    <span className="rounded-full border border-td-accent/[0.1] bg-td-accent/[0.03] px-2.5 py-1 text-[11px] text-td-accent-text">
                      {group.cards.length} unique
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {group.cards.map((card) => (
                      <RoleCardPreview
                        key={card.id}
                        card={card}
                        onSelect={() =>
                          selectCard(card.id)
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
                  className="rounded-[22px] border border-td-ink/[0.065] bg-td-surface p-5"
                >
                  <p className="text-[12px] font-semibold uppercase tracking-[0.11em] text-td-accent-text">
                    {entry.type}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-td-primary">
                    {entry.copies}
                  </p>
                  <p className="mt-2 text-[12px] text-td-muted">
                    {entry.unique} unique cards
                  </p>
                  <p className="mt-4 text-[14px] font-semibold text-td-success">
                    ${entry.value.toFixed(2)}
                  </p>
                </div>
              ))}
            </section>
          ) : null}
        </main>

        <aside className="xl:sticky xl:top-[190px] xl:self-start">
          <section className="overflow-hidden rounded-[24px] border border-td-accent/[0.1] bg-td-surface">
            {inspectorCard ? (
              <>
                <div className="border-b border-td-ink/[0.055] px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-accent-text">
                      Live Inspector
                    </p>
                    <span className={[
                      "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]",
                      inspectorLocked
                        ? "bg-td-accent text-td-on-accent"
                        : "border border-td-ink/[0.08] bg-td-ink/[0.025] text-td-secondary",
                    ].join(" ")}>
                      {inspectorLocked ? "Selected" : "Previewing"}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <InspectorCardImage card={inspectorCard} />
                  <h3 className="mt-2 text-[18px] font-semibold leading-6 text-td-primary">
                    {inspectorCard.name}
                  </h3>
                  <p className="mt-2 text-[12px] leading-5 text-td-muted">
                    {inspectorCard.typeLine}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <InspectorMetric
                      label="Quantity"
                      value={`${inspectorCard.quantity}`}
                    />
                    <InspectorMetric
                      label="Mana Value"
                      value={`${inspectorCard.manaValue}`}
                    />
                    <InspectorMetric
                      label="Price"
                      value={`$${inspectorCard.price.toFixed(2)}`}
                    />
                    <InspectorMetric
                      label="Owned"
                      value={`${Math.min(
                        inspectorCard.quantity,
                        inspectorCard.ownedQuantity ??
                          (inspectorCard.owned
                            ? inspectorCard.quantity
                            : 0),
                      )} / ${inspectorCard.quantity}`}
                    />
                  </div>

                  <OwnershipLocations card={inspectorCard} />

                  {inspectorLocked ? (
                  <div className="mt-5 space-y-2">
                    {isCommander ? <InspectorAction
                      href={edhrecCardUrl(
                        inspectorCard.name,
                      )}
                      tone="cyan"
                    >
                      Analyze on EDHREC
                    </InspectorAction> : null}
                    <InspectorAction
                      tone="violet"
                      onClick={() =>
                        setReplacementCard(inspectorCard)
                      }
                    >
                      Find Replacement
                    </InspectorAction>
                    <InspectorAction
                      tone="rose"
                      onClick={() =>
                        trashCardFromDeck(inspectorCard)
                      }
                    >
                      <span className="inline-flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        Remove one copy from deck
                      </span>
                    </InspectorAction>
                  </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-td-ink/[0.065] bg-td-ink/[0.018] px-3 py-3 text-[11px] leading-5 text-td-muted">
                      Click this card in Deck Canvas to lock it for editing, replacement, or removal.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-6 text-center">
                <Eye className="mx-auto h-6 w-6 text-td-muted" />
                <p className="mt-3 text-[13px] text-td-muted">
                  Select a card to inspect it.
                </p>
              </div>
            )}
          </section>

          <section className="mt-4 rounded-[22px] border border-td-ink/[0.065] bg-td-surface p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.11em] text-td-muted">
              Deck Health
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
        <TournamentDeckShowcaseStudio
          deckName={deckName}
          commanderName={commanderName}
          format={format}
          cards={cards}
          marketValue={mainDeckValue}
          onClose={() => setShowcaseOpen(false)}
        />
      ) : null}
      {replacementCard ? (
        <ReplacementFinder
          card={replacementCard}
          format={format}
          deckColors={deckColors}
          onClose={() => setReplacementCard(null)}
          onReplace={(replacement) => {
            replaceCard(replacementCard, replacement);
            setReplacementCard(null);
          }}
        />
      ) : null}
    
      <div className="sticky bottom-3 z-30 mx-auto mt-4 hidden max-w-[820px] items-center justify-center gap-1 rounded-[20px] border border-td-ink/[0.08] bg-td-surface/95 p-2 shadow-[0_22px_70px_rgb(var(--td-shadow-rgb)/calc(.46*var(--td-shadow-strength)))] backdrop-blur-2xl lg:flex">
        <span className="sr-only">Deck Studio Action Dock</span>
        <button type="button" className="studio-dock-action">
          <Undo2 className="h-4 w-4" />
          <span>Undo</span>
        </button>
        <button type="button" className="studio-dock-action">
          <Redo2 className="h-4 w-4" />
          <span>Redo</span>
        </button>
        <button
          type="button"
          onClick={() => selectedCard && trashCardFromDeck(selectedCard)}
          className="studio-dock-action text-td-danger"
        >
          <Trash2 className="h-4 w-4" />
          <span>Trash</span>
        </button>
        <button type="button" className="studio-dock-action">
          <Copy className="h-4 w-4" />
          <span>Duplicate</span>
        </button>
        <button type="button" className="studio-dock-action">
          <Move className="h-4 w-4" />
          <span>Move</span>
        </button>
        <button
          type="button"
          onClick={() => selectedCard && setReplacementCard(selectedCard)}
          className="studio-dock-action"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Replace</span>
        </button>
        <button type="button" className="studio-dock-action">
          <ArrowUpDown className="h-4 w-4" />
          <span>Sort</span>
        </button>
        <button
          type="button"
          onClick={() => setView("stats")}
          className="studio-dock-action text-td-violet"
        >
          <Sparkles className="h-4 w-4" />
          <span>AI Optimize</span>
        </button>
      </div>
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
  "Sideboard",
  "Considering",
];

function deckCardGroup(card: DeckCard) {
  if (card.board === "commander" || card.category === "Commander") return "Commander";
  if (card.board === "sideboard") return "Sideboard";
  if (card.board === "maybeboard") return "Considering";
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

function DeckCondensedView({
  cards,
  selectedCardId,
  previewCardId,
  onSelect,
  onPreview,
  onPreviewEnd,
  onTrash,
}: {
  cards: DeckCard[];
  selectedCardId: string | null;
  previewCardId: string | null;
  onSelect: (id: string) => void;
  onPreview: (id: string) => void;
  onPreviewEnd: (id?: string) => void;
  onTrash: (card: DeckCard) => void;
}) {
const groups = groupedDeckCards(cards);
  const mainGroups = groups.filter(
    (group) => group.type !== "Sideboard" && group.type !== "Considering",
  );
  const separateGroups = groups.filter(
    (group) => group.type === "Sideboard" || group.type === "Considering",
  );

  const identityAccent = (colors: DeckCard["colors"]) => {
    const palette: Record<DeckCard["colors"][number], string> = {
      W: "#f3e6b3",
      U: "#39a7e8",
      B: "#8b78a7",
      R: "#ef684f",
      G: "#50b978",
      C: "#7f91a3",
    };
    const identity = [...new Set(colors.length ? colors : ["C" as const])];
    if (identity.length === 1) return palette[identity[0]];
    return `linear-gradient(180deg, ${identity
      .map((color, index) => {
        const start = Math.round((index / identity.length) * 100);
        const end = Math.round(((index + 1) / identity.length) * 100);
        return `${palette[color]} ${start}%, ${palette[color]} ${end}%`;
      })
      .join(", ")})`;
  };

  const renderGroups = (deckGroups: typeof groups) =>
    deckGroups.map((group) => (
      <section
        key={group.type}
        className="mb-3 inline-block w-full break-inside-avoid overflow-hidden rounded-[18px] border border-td-ink/[0.075] bg-td-surface shadow-[0_14px_38px_rgb(var(--td-shadow-rgb)/calc(.18*var(--td-shadow-strength)))]"
      >
        <div className="flex items-center justify-between border-b border-td-ink/[0.055] bg-[linear-gradient(90deg,rgb(var(--td-accent-rgb)/.09),rgb(var(--td-accent-rgb)/.025)_58%,transparent)] px-3.5 py-2.5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-td-accent-text">
            {group.type}
          </p>
          <span className="min-w-6 rounded-full border border-td-accent/10 bg-td-accent-hover/[0.07] px-2 py-0.5 text-center text-[11px] font-extrabold text-td-accent-text">
            {group.cards.reduce((total, card) => total + card.quantity, 0)}
          </span>
        </div>
        <div className="divide-y divide-td-ink/[0.04] py-1">
          {group.cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelect(card.id)}
              onMouseEnter={() => onPreview(card.id)}
              onMouseLeave={() => onPreviewEnd(card.id)}
              onFocus={() => onPreview(card.id)}
              onBlur={() => onPreviewEnd(card.id)}
              className={[
                "group relative flex min-h-9 w-full items-center gap-2.5 overflow-hidden px-3.5 py-2 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-td-accent/50",
                selectedCardId === card.id
                  ? "bg-td-accent-hover/[0.085] text-td-on-accent"
                  : previewCardId === card.id
                    ? "bg-td-accent-hover/[0.055]"
                    : "hover:bg-td-accent-hover/[0.045] focus-visible:bg-td-accent-hover/[0.055]",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className={[
                  "absolute inset-y-1.5 left-0 w-[3px] rounded-r-full transition group-hover:opacity-100",
                  selectedCardId === card.id || previewCardId === card.id
                    ? "opacity-100"
                    : "opacity-60",
                ].join(" ")}
                style={{ background: identityAccent(card.colors) }}
              />
              <span className="inline-flex h-5 min-w-7 shrink-0 items-center justify-center rounded-md border border-td-ink/[0.07] bg-td-ink/[0.045] px-1.5 text-[11px] font-extrabold tabular-nums text-td-primary">
                {card.quantity}×
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-td-primary transition group-hover:text-td-primary">
                {card.name}
              </span>
              <span
                title={`Mana value ${card.manaValue}`}
                className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-td-ink/[0.07] bg-black/20 px-1.5 text-[11px] font-bold tabular-nums text-td-muted"
              >
                {card.manaValue}
              </span>
              <span className="w-14 shrink-0 text-right text-[11px] font-medium tabular-nums text-td-success/65">
                ${(card.price * card.quantity).toFixed(2)}
              </span>
              <span
                role="button"
                tabIndex={0}
                aria-label={`Remove one copy of ${card.name} from deck`}
                title="Remove one copy from deck"
                onClick={(event) => {
                  event.stopPropagation();
                  onTrash(card);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onTrash(card);
                  }
                }}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-td-danger/[0.14] bg-td-danger/[0.04] text-td-danger/75 opacity-0 transition group-hover:opacity-100 focus:opacity-100 hover:bg-td-danger/[0.1] hover:text-td-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      </section>
    ));

  return (
    <section className="overflow-hidden rounded-[28px] border border-td-ink/[0.075] bg-[radial-gradient(circle_at_top_left,rgb(var(--td-accent-rgb)/.06),transparent_30%),var(--td-surface-default)] shadow-[0_30px_90px_rgb(var(--td-shadow-rgb)/calc(.28*var(--td-shadow-strength)))]">
      <div className="flex items-center justify-between border-b border-td-ink/[0.06] px-5 py-4">
        <div>
          <div className="flex items-center gap-2.5">
            <p className="text-[17px] font-semibold tracking-[-0.01em] text-td-primary">Deck Canvas</p>
            <span className="rounded-md border border-td-accent/10 bg-td-accent-hover/[0.055] px-1.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-td-accent-text/80">
              Condensed
            </span>
          </div>
          <p className="mt-1 text-[12px] text-td-muted">
            A clean, complete scan of every card in your build
          </p>
        </div>
        <span className="rounded-full border border-td-accent/[0.12] bg-td-accent-hover/[0.045] px-3 py-1 text-[11px] font-bold tabular-nums text-td-accent-text">
          {cards.reduce((total, card) => total + card.quantity, 0)} cards
        </span>
      </div>

      <div className="columns-1 gap-3 p-4 md:columns-2 2xl:columns-3">
        {renderGroups(mainGroups)}
      </div>
      {separateGroups.length ? (
        <div className="border-t border-td-accent/[0.12] bg-td-accent/[0.018] p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-td-muted">
            Outside the main deck
          </p>
          <div className="columns-1 gap-3 md:columns-2 2xl:columns-3">
            {renderGroups(separateGroups)}
          </div>
        </div>
      ) : null}
      
    </section>
  );
}

function DeckColumnsView({
  cards,
  onSelect,
}: {
  cards: DeckCard[];
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-[24px] border border-td-ink/[0.07] bg-td-surface p-5">
      <div className="columns-1 gap-4 md:columns-2 2xl:columns-3">
        {groupedDeckCards(cards).map((group) => (
          <section
            key={group.type}
            className="mb-4 inline-block w-full break-inside-avoid overflow-hidden rounded-2xl border border-td-ink/[0.065] bg-td-surface"
          >
            <div className="flex items-center justify-between border-b border-td-ink/[0.06] px-4 py-3">
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-td-accent-text">
                {group.type}
              </p>
              <span className="text-[11px] text-td-muted">
                {group.cards.reduce((total, card) => total + card.quantity, 0)}
              </span>
            </div>
            <div className="py-1.5">
              {group.cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onSelect(card.id)}
                  className="group flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-td-accent/[0.045]"
                >
                  <span className="w-5 text-[11px] font-bold text-td-muted">
                    {card.quantity}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-td-secondary group-hover:text-td-accent-text">
                    {card.name}
                  </span>
                  <ManaSymbols colors={card.colors} size="sm" />
                  <span className="text-[11px] text-td-muted">
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
    <section className="overflow-hidden rounded-[24px] border border-td-accent/[0.09] bg-[radial-gradient(circle_at_top,var(--td-surface-default)_0,var(--td-surface-default)_42%,var(--td-surface-default)_100%)] p-5">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-[17px] font-semibold text-td-primary">Tabletop Stacks</p>
          <p className="mt-1 text-[12px] text-td-muted">
            A physical, artwork-forward view of the complete deck.
          </p>
        </div>
        <span className="rounded-full border border-td-accent/10 bg-td-accent/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-td-accent-text">
          Trading Docks display
        </span>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
        {groupedDeckCards(cards).map((group) => (
          <section key={group.type} className="min-w-0">
            <div className="mb-3 flex items-center justify-between border-b border-td-ink/[0.07] pb-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-td-secondary">
                {group.type}
              </p>
              <span className="text-[11px] text-td-muted">
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
                  <div className="relative aspect-[1.9] overflow-hidden rounded-xl border border-td-ink/10 bg-td-surface shadow-[0_-8px_18px_rgb(var(--td-shadow-rgb)/calc(0.3*var(--td-shadow-strength)))]">
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
                        <p className="truncate text-[12px] font-semibold text-td-primary">{card.name}</p>
                        <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-td-secondary">
                          {card.setCode || group.type}
                        </p>
                      </div>
                      {card.quantity > 1 ? (
                        <span className="ml-2 rounded-full bg-td-accent px-2 py-1 text-[11px] font-black text-td-on-accent">
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
type ShowcaseDisplay = "cards" | "text";

const SHOWCASE_LAYOUT: Record<
  ShowcaseSize,
  { columns: number; canvasGap: number; previewGap: string }
> = {
  square: { columns: 4, canvasGap: 12, previewGap: "0.55rem" },
  portrait: { columns: 3, canvasGap: 12, previewGap: "0.55rem" },
  story: { columns: 2, canvasGap: 14, previewGap: "0.65rem" },
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

function showcaseGroupWeight(group: ReturnType<typeof buildShowcaseGroups>[number]) {
  return 1.15 + group.cards.length;
}

function buildShowcaseLanes(
  groups: ReturnType<typeof buildShowcaseGroups>,
  laneCount: number,
  isolateSideboard = false,
) {
  const separated = isolateSideboard
    ? groups.filter((group) => group.category === "Sideboard" || group.category === "Considering")
    : [];
  const mainGroups = isolateSideboard
    ? groups.filter((group) => group.category !== "Sideboard" && group.category !== "Considering")
    : groups;
  const mainLaneCount = Math.max(1, laneCount - (separated.length ? 1 : 0));
  const lanes = Array.from({ length: mainLaneCount }, () => ({
    groups: [] as typeof groups,
    weight: 0,
  }));

  mainGroups.forEach((group) => {
    const shortestLane = lanes.reduce((best, lane) =>
      lane.weight < best.weight ? lane : best,
    );
    shortestLane.groups.push(group);
    shortestLane.weight += showcaseGroupWeight(group);
  });

  if (separated.length) {
    lanes.push({
      groups: separated,
      weight: separated.reduce((total, group) => total + showcaseGroupWeight(group), 0),
    });
  }

  return lanes;
}

function longestLaneFirst(
  lanes: ReturnType<typeof buildShowcaseLanes>,
) {
  return [...lanes].sort((left, right) => right.weight - left.weight);
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
  const [display, setDisplay] = useState<ShowcaseDisplay>("cards");
  const [showValue, setShowValue] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showLink, setShowLink] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
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

  async function loadCardCanvasImage(card: DeckCard) {
    const sameOriginImage = `/api/deck-vault/card-image?name=${encodeURIComponent(card.name)}`;
    const candidates = [sameOriginImage, card.image].filter(
      (source): source is string => Boolean(source),
    );
    for (const source of candidates) {
      try {
        return await loadCanvasImage(source);
      } catch {
        // The account may contain an expired remote URL. The same-origin
        // endpoint remains the durable source for downloadable graphics.
      }
    }
    return null;
  }

  async function buildShowcasePng() {
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

      const brandWordmark = await loadBrandImage("horizontal");
      context.fillStyle = "rgba(1,8,14,.9)";
      roundedRect(context, 24, 18, 238, 66, 12);
      context.fill();
      context.strokeStyle = "rgba(103,232,249,.28)";
      context.lineWidth = 1;
      roundedRect(context, 24, 18, 238, 66, 12);
      context.stroke();
      if (brandWordmark) {
        context.drawImage(brandWordmark, 38, 27, 210, 42);
      } else {
        context.fillStyle = "#ffffff";
        context.font = `900 21px ${showcaseFont}`;
        context.fillText("TRADING DOCKS", 46, 58);
      }
      context.fillStyle = "#ffffff";
      context.font = `900 40px ${showcaseFont}`;
      wrapCanvasText(context, deckName || "Untitled Deck", 290, 41, 748, 43, 1);
      context.fillStyle = "#94a3b8";
      context.font = `650 16px ${showcaseFont}`;
      context.fillText(
        `${format}${commanderName ? `  •  COMMANDER: ${commanderName}` : ""}`,
        290,
        70,
      );
      context.fillStyle = "#ffffff";
      context.font = `800 16px ${showcaseFont}`;
      context.fillText(
        `${cardCount} CARDS${showValue ? `  •  DECK VALUE $${marketValue.toFixed(2)}` : ""}`,
        290,
        93,
      );

      let posterTop = 100;
      if (showStats) {
        const statTop = 98;
        context.fillStyle = "rgba(255,255,255,.075)";
        roundedRect(context, 24, statTop, canvas.width - 48, 60, 10);
        context.fill();

        context.font = `800 12px ${showcaseFont}`;
        context.fillStyle = "#94a3b8";
        context.fillText(`AVG MV`, 42, statTop + 18);
        context.fillText(`CREATURES`, 131, statTop + 18);
        context.fillText(`SPELLS`, 248, statTop + 18);
        context.fillText(`LANDS`, 340, statTop + 18);
        context.font = `900 17px ${showcaseFont}`;
        context.fillStyle = "#ffffff";
        context.fillText(stats.averageManaValue.toFixed(2), 42, statTop + 43);
        context.fillText(String(stats.typeCounts.creatures), 131, statTop + 43);
        context.fillText(String(stats.typeCounts.spells), 248, statTop + 43);
        context.fillText(String(stats.typeCounts.lands), 340, statTop + 43);

        const colorFills: Record<string, string> = {
          W: "#f5e8b6",
          U: "#38a8e8",
          B: "#8b7b9d",
          R: "#ef6351",
          G: "#43c985",
        };
        stats.colorCounts.forEach((entry, index) => {
          const x = 441 + index * 45;
          context.fillStyle = colorFills[entry.color];
          context.beginPath();
          context.arc(x, statTop + 22, 11, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#06131f";
          context.font = `900 12px ${showcaseFont}`;
          context.textAlign = "center";
          context.fillText(entry.color, x, statTop + 26);
          context.fillStyle = "#cbd5e1";
          context.font = `800 12px ${showcaseFont}`;
          context.fillText(String(entry.count), x, statTop + 48);
        });
        context.textAlign = "left";

        const curveLeft = 720;
        const curveBottom = statTop + 46;
        const curveMax = Math.max(1, ...stats.manaCurve);
        stats.manaCurve.forEach((count, index) => {
          const height = Math.max(3, (count / curveMax) * 30);
          const x = curveLeft + index * 38;
          context.fillStyle = accent;
          context.fillRect(x, curveBottom - height, 27, height);
          context.fillStyle = "#94a3b8";
          context.font = `700 10px ${showcaseFont}`;
          context.textAlign = "center";
          context.fillText(index === 7 ? "7+" : String(index), x + 13, statTop + 57);
        });
        context.textAlign = "left";
        posterTop = 174;
      }
      const posterBottom = canvas.height - 92;
      const posterHeight = posterBottom - posterTop;
      const posterLeft = 24;
      const posterWidth = canvas.width - posterLeft * 2;
      const columnCount = Math.min(
        SHOWCASE_LAYOUT[size].columns,
        Math.max(1, groups.length),
      );
      const columnGap = SHOWCASE_LAYOUT[size].canvasGap;
      const rowGap = SHOWCASE_LAYOUT[size].canvasGap;
      const columnWidth =
        (posterWidth - columnGap * Math.max(0, columnCount - 1)) / columnCount;
      const showcaseLanes = buildShowcaseLanes(groups, columnCount);
      const loadedImages = new Map<string, HTMLImageElement>();
      await Promise.all(
        groups.flatMap((group) => group.cards).map(async (card) => {
          const image = await loadCardCanvasImage(card);
          if (image) loadedImages.set(card.id, image);
        }),
      );

      if (display === "text") {
        const textColumns = size === "story" ? 1 : 2;
        const textGap = 26;
        const textColumnWidth =
          (posterWidth - textGap * (textColumns - 1)) / textColumns;
        const textLanes = longestLaneFirst(
          buildShowcaseLanes(groups, textColumns),
        );
        const maxEntries = Math.max(
          1,
          ...textLanes.map((lane) =>
            lane.groups.reduce((total, group) => total + group.cards.length + 1, 0),
          ),
        );
        const lineHeight = Math.min(38, Math.max(25, posterHeight / (maxEntries + 1)));

        textLanes.forEach((lane, column) => {
          const x = posterLeft + column * (textColumnWidth + textGap);
          let y = posterTop;
          lane.groups.forEach((group) => {
            context.fillStyle = "rgba(103,232,249,.13)";
            roundedRect(context, x, y + 2, textColumnWidth, lineHeight - 4, 5);
            context.fill();
            context.fillStyle = "#ffffff";
            context.font = `900 ${Math.max(15, lineHeight * 0.5)}px ${showcaseFont}`;
            context.fillText(
              `${group.category.toUpperCase()} (${group.count})`,
              x + 10,
              y + lineHeight * 0.68,
            );
            y += lineHeight;
            group.cards.forEach((card) => {
              const price = card.price * card.quantity;
              context.fillStyle = "#cbd5e1";
              context.font = `800 ${Math.max(14, lineHeight * 0.45)}px ${showcaseFont}`;
              context.fillText(String(card.quantity), x + 3, y + lineHeight * 0.68);
              context.fillStyle = "#67e8f9";
              context.font = `750 ${Math.max(14, lineHeight * 0.45)}px ${showcaseFont}`;
              const nameWidth = textColumnWidth * 0.58;
              context.fillText(
                card.name.length > 31 ? `${card.name.slice(0, 29)}…` : card.name,
                x + 27,
                y + lineHeight * 0.68,
                nameWidth,
              );
              context.fillStyle = "#ffffff";
              context.font = `700 ${Math.max(13, lineHeight * 0.42)}px ${showcaseFont}`;
              context.textAlign = "right";
              context.fillText(
                `$${price.toFixed(2)}`,
                x + textColumnWidth - 3,
                y + lineHeight * 0.68,
              );
              context.textAlign = "left";
              y += lineHeight;
            });
            y += 4;
          });
        });
      } else {
        showcaseLanes.forEach((lane, laneIndex) => {
          const x = posterLeft + laneIndex * (columnWidth + columnGap);
          const cardRowHeight = Math.max(
            34,
            Math.min(48, (posterHeight - lane.groups.length * 35) /
              Math.max(1, lane.groups.reduce((total, group) => total + group.cards.length, 0))),
          );
          let groupTop = posterTop;

          lane.groups.forEach((group) => {
            const groupWidth = columnWidth;
            const groupHeight = 32 + group.cards.length * cardRowHeight + 7;
            context.fillStyle = "rgba(1,8,14,.82)";
            roundedRect(context, x, groupTop, groupWidth, groupHeight, 8);
            context.fill();
            context.strokeStyle = "rgba(103,232,249,.13)";
            roundedRect(context, x, groupTop, groupWidth, groupHeight, 8);
            context.stroke();
            context.fillStyle = "rgba(103,232,249,.12)";
            roundedRect(context, x + 5, groupTop + 5, groupWidth - 10, 23, 5);
            context.fill();
            context.fillStyle = "#ffffff";
            context.font = `900 13px ${showcaseFont}`;
            context.fillText(
              `${group.category.toUpperCase()} · ${group.count}`,
              x + 12,
              groupTop + 21,
            );
            group.cards.forEach((card, cardIndex) => {
              const y = groupTop + 32 + cardIndex * cardRowHeight;
              const imageWidth = Math.min(74, groupWidth * 0.31);
              const imageHeight = cardRowHeight - 5;
              const image = loadedImages.get(card.id);
              if (image) {
                const sourceHeight = Math.max(1, image.naturalHeight * 0.34);
                const sourceY = Math.max(0, (image.naturalHeight - sourceHeight) * 0.3);
                context.save();
                roundedRect(context, x + 6, y + 2, imageWidth, imageHeight, 4);
                context.clip();
                context.drawImage(
                  image,
                  0,
                  sourceY,
                  image.naturalWidth,
                  sourceHeight,
                  x + 6,
                  y + 2,
                  imageWidth,
                  imageHeight,
                );
                context.restore();
              } else {
                context.fillStyle = "#102331";
                roundedRect(context, x + 6, y + 2, imageWidth, imageHeight, 4);
                context.fill();
              }
              context.fillStyle = "#ffffff";
              context.font = `800 ${Math.max(11, cardRowHeight * 0.31)}px ${showcaseFont}`;
              const name = card.name.length > 23 ? `${card.name.slice(0, 21)}…` : card.name;
              context.fillText(name, x + imageWidth + 14, y + cardRowHeight * 0.59, groupWidth - imageWidth - 48);
              context.fillStyle = accent;
              context.font = `900 ${Math.max(11, cardRowHeight * 0.31)}px ${showcaseFont}`;
              context.textAlign = "right";
              context.fillText(`×${card.quantity}`, x + groupWidth - 9, y + cardRowHeight * 0.59);
              context.textAlign = "left";
            });
            groupTop += groupHeight + rowGap;
          });
        });
      }

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
      if (!blob) return null;
      const fileName = `${(deckName || "trading-docks-deck")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-showcase.png`;
      return { blob, fileName, file: new File([blob], fileName, { type: "image/png" }) };
    } finally {
      setExporting(false);
    }
  }

  async function downloadShowcase() {
    const result = await buildShowcasePng();
    if (!result) return;
    const href = URL.createObjectURL(result.blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = result.fileName;
    link.click();
    URL.revokeObjectURL(href);
    setShareStatus("PNG downloaded");
  }

  async function shareShowcase() {
    const result = await buildShowcasePng();
    if (!result) return;
    if (navigator.share && navigator.canShare?.({ files: [result.file] })) {
      try {
        await navigator.share({
          title: `${deckName} — Trading Docks Deck Vault`,
          text: `Check out my ${format} deck built in Trading Docks.`,
          files: [result.file],
        });
        setShareStatus("Share sheet opened");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await downloadShowcase();
    setShareStatus("PNG downloaded — attach it to your post");
  }

  function downloadBlob(blob: Blob, fileName: string) {
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  async function shareToMedia(network: "instagram" | "discord") {
    const result = await buildShowcasePng();
    if (!result) return;
    const caption = `Check out my ${format} deck, ${deckName}, built in the Trading Docks Deck Vault.\n${publicUrl}`;

    try {
      await navigator.clipboard.writeText(caption);
    } catch {
      // The PNG still downloads when clipboard access is unavailable.
    }

    if (
      navigator.share &&
      navigator.canShare?.({ files: [result.file] }) &&
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    ) {
      try {
        await navigator.share({
          title: `${deckName} — Trading Docks`,
          text: caption,
          files: [result.file],
        });
        setShareStatus(`${network === "instagram" ? "Instagram" : "Discord"} share opened`);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    downloadBlob(result.blob, result.fileName);
    window.open(
      network === "instagram" ? "https://www.instagram.com/" : "https://discord.com/channels/@me",
      "_blank",
      "noopener,noreferrer",
    );
    setShareStatus(
      `PNG downloaded and caption copied — attach it in ${network === "instagram" ? "Instagram" : "Discord"}`,
    );
  }

  async function copyDeckLink() {
    await navigator.clipboard.writeText(publicUrl);
    setShareStatus("Deck link copied");
  }

  function openSocial(network: "facebook" | "x") {
    const encodedUrl = encodeURIComponent(publicUrl);
    const text = encodeURIComponent(`Check out my ${format} deck, ${deckName}, built in Trading Docks.`);
    const url =
      network === "facebook"
        ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
        : `https://x.com/intent/post?url=${encodedUrl}&text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer,width=720,height=680");
  }

  const previewGradient = {
    harbor: "from-td-raised via-td-surface to-td-canvas",
    midnight: "from-td-raised via-td-surface to-td-canvas",
    color: "",
    black: "from-black via-black to-black",
  }[theme];
  const previewBackground =
    theme === "color" ? deckIdentityGradient(identityColors) : undefined;
  const previewColumnCount = Math.min(SHOWCASE_LAYOUT[size].columns, Math.max(1, groups.length));
  const previewLanes = buildShowcaseLanes(groups, previewColumnCount);
  const previewTextLanes = longestLaneFirst(
    buildShowcaseLanes(groups, size === "story" ? 1 : 2),
  );

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-td-canvas/92 p-4 backdrop-blur-xl">
      <div className="mx-auto flex min-h-full max-w-[1480px] items-center justify-center">
        <section className="w-full overflow-hidden rounded-[28px] border border-td-accent/15 bg-td-surface shadow-[0_30px_120px_rgb(var(--td-shadow-rgb)/calc(.65*var(--td-shadow-strength)))]">
          <header className="flex items-center justify-between border-b border-td-ink/[0.07] px-6 py-3">
            <div className="flex items-center gap-4">
              <img
                src="/trading-docks-horizontal.png"
                onError={(event) => {
                  event.currentTarget.src = "/brand/trading-docks-horizontal.png";
                }}
                alt="Trading Docks"
                className="hidden h-9 w-auto max-w-[150px] object-contain sm:block"
              />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-td-accent-text">
                  Showcase Studio
                </p>
              <h2 className="mt-0.5 text-lg font-semibold text-td-primary">Create and share your full-deck poster</h2>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl border border-td-ink/10 p-2.5 text-td-secondary hover:text-td-primary">
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="border-b border-td-ink/[0.07] p-5 lg:border-b-0 lg:border-r">
              <ShowcaseControl title="Deck display">
                {([
                  ["cards", "Visual cards"],
                  ["text", "Text list"],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setDisplay(value)} className={`rounded-xl border px-3 py-2 text-[11px] font-semibold ${display === value ? "border-td-accent/30 bg-td-accent/10 text-td-accent-text" : "border-td-ink/[0.07] text-td-muted"}`}>
                    {label}
                  </button>
                ))}
              </ShowcaseControl>
              <ShowcaseControl title="Social size">
                {([
                  ["portrait", "Instagram 4:5"],
                  ["square", "Square 1:1"],
                  ["story", "Story 9:16"],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setSize(value)} className={`rounded-xl border px-3 py-2 text-[11px] font-semibold ${size === value ? "border-td-accent/30 bg-td-accent/10 text-td-accent-text" : "border-td-ink/[0.07] text-td-muted"}`}>
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
                  <button key={value} type="button" onClick={() => setTheme(value)} className={`rounded-xl border px-3 py-2 text-[11px] font-semibold ${theme === value ? "border-td-accent/30 bg-td-accent/10 text-td-accent-text" : "border-td-ink/[0.07] text-td-muted"}`}>
                    {label}
                  </button>
                ))}
              </ShowcaseControl>
              <ShowcaseControl title="Include">
                <ShowcaseToggle label="Deck value" checked={showValue} onChange={setShowValue} />
                <ShowcaseToggle label="Deck stats" checked={showStats} onChange={setShowStats} />
                <ShowcaseToggle label="Public deck link" checked={showLink} onChange={setShowLink} />
              </ShowcaseControl>
              <div className="mt-7 rounded-2xl border border-td-accent/10 bg-td-accent/[0.035] p-4">
                <p className="text-[11px] font-semibold text-td-accent-text">Full-deck poster</p>
                <p className="mt-2 text-[11px] leading-5 text-td-muted">
                  Every unique card is shown once with a clear quantity badge, and every export carries the Trading Docks signature.
                </p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => void downloadShowcase()} disabled={exporting} className="col-span-2 flex h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-xl bg-td-accent px-4 text-[12px] font-black text-td-on-accent shadow-[0_8px_24px_rgb(var(--td-accent-rgb)/.18)] transition hover:bg-td-accent-hover disabled:opacity-60">
                  <Download className="h-4 w-4" /> {exporting ? "Building HD graphic…" : "Download HD PNG"}
                </button>
                <button type="button" onClick={() => void copyDeckLink()} className="flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-td-ink/10 bg-td-ink/[0.04] px-3 text-[11px] font-bold text-td-primary transition hover:border-td-ink/20 hover:bg-td-ink/[0.08]">
                  <Copy className="h-4 w-4" /> Copy link
                </button>
                <button type="button" onClick={() => void shareShowcase()} disabled={exporting} className="flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-td-accent/25 bg-td-accent/[0.07] px-3 text-[11px] font-bold text-td-accent-text transition hover:bg-td-accent/10 disabled:opacity-60">
                  <Share2 className="h-4 w-4" /> More apps
                </button>
              </div>
              <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-td-secondary">Share directly</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => openSocial("facebook")} className="flex h-10 items-center justify-center rounded-xl border border-td-accent-text/35 bg-td-accent/10 px-2 text-[11px] font-bold text-td-accent-text transition hover:bg-td-accent/20 hover:text-td-primary">Facebook</button>
                <button type="button" onClick={() => openSocial("x")} className="flex h-10 items-center justify-center rounded-xl border border-td-ink/15 bg-td-ink/[0.045] px-2 text-[11px] font-bold text-td-primary transition hover:bg-td-ink/10">X</button>
                <button type="button" onClick={() => void shareToMedia("instagram")} disabled={exporting} className="flex h-10 items-center justify-center rounded-xl border border-fuchsia-400/25 bg-gradient-to-r from-fuchsia-500/10 via-td-danger/10 to-td-warning/10 px-2 text-[11px] font-bold text-td-danger transition hover:border-td-danger/50 hover:text-td-primary disabled:opacity-60">Instagram</button>
                <button type="button" onClick={() => void shareToMedia("discord")} disabled={exporting} className="flex h-10 items-center justify-center rounded-xl border border-td-violet/30 bg-td-violet/10 px-2 text-[11px] font-bold text-td-violet transition hover:bg-td-violet/20 hover:text-td-primary disabled:opacity-60">Discord</button>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-td-muted">
                Instagram and Discord download the finished PNG, copy the caption, and open the platform.
              </p>
              {shareStatus ? <p className="mt-3 text-center text-[11px] font-semibold text-td-accent-text">{shareStatus}</p> : null}
            </aside>
            <main className="flex min-h-[820px] items-center justify-center overflow-hidden bg-td-canvas p-2 sm:p-3">
              <div
                className={`relative w-full max-w-[1100px] overflow-hidden rounded-[20px] border border-td-ink/10 bg-gradient-to-br ${previewGradient} p-3 shadow-[0_24px_80px_rgb(var(--td-shadow-rgb)/calc(.55*var(--td-shadow-strength)))] sm:p-4 ${size === "square" ? "aspect-square" : size === "story" ? "aspect-[9/16] max-w-[600px]" : "aspect-[4/5] max-w-[900px]"}`}
                style={previewBackground ? { backgroundImage: previewBackground } : undefined}
              >
                {theme !== "black" ? (
                  <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "repeating-linear-gradient(135deg,transparent 0,transparent 32px,#67e8f9 33px,#67e8f9 34px)" }} />
                ) : null}
                <div className="relative flex h-full flex-col font-sans">
                  <div className="grid grid-cols-[minmax(210px,0.72fr)_minmax(0,1.28fr)] items-stretch gap-2.5">
                    <div className="relative overflow-hidden rounded-lg border border-td-accent/25 bg-td-canvas/90 px-3.5 py-3 shadow-[0_8px_30px_rgb(var(--td-shadow-rgb)/calc(.4*var(--td-shadow-strength)))]">
                      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-td-accent to-td-accent" />
                      <div className="min-w-0">
                        <img
                          src="/trading-docks-horizontal.png"
                          onError={(event) => {
                            event.currentTarget.src = "/brand/trading-docks-horizontal.png";
                          }}
                          alt="Trading Docks"
                          className="h-10 w-auto max-w-[210px] object-contain object-left"
                        />
                        <p className="mt-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-td-accent-text">Made in Deck Vault</p>
                      </div>
                      <div className="mt-2.5 flex items-center gap-1.5 border-t border-td-ink/10 pt-2">
                        <span className="rounded bg-td-accent/10 px-2 py-0.5 text-[11px] font-bold uppercase text-td-accent-text">{format}</span>
                        <span className="truncate text-[11px] font-semibold text-td-secondary">
                          {commanderName ? `Commander · ${commanderName}` : "Built to share"}
                        </span>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-col justify-center rounded-lg border border-td-ink/[0.07] bg-black/20 px-4 py-2.5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-td-secondary">Deck showcase</p>
                      <h3 className="mt-1 truncate text-[clamp(24px,3.4vw,40px)] font-black leading-none tracking-[-0.035em] text-td-primary">{deckName}</h3>
                      <p className="mt-2 truncate text-[11px] font-semibold text-td-primary">
                        {cardCount} cards {showValue ? `· $${marketValue.toFixed(2)} total value` : ""} · tradingdocks.com
                      </p>
                    </div>
                  </div>
                  {showStats ? (
                    <div className="mt-1.5 grid grid-cols-[repeat(4,minmax(0,1fr))_1.8fr] gap-2 rounded-lg border border-td-ink/[0.07] bg-td-ink/[0.045] px-3 py-2">
                      {[
                        ["Avg MV", stats.averageManaValue.toFixed(2)],
                        ["Creatures", stats.typeCounts.creatures],
                        ["Spells", stats.typeCounts.spells],
                        ["Lands", stats.typeCounts.lands],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-td-secondary">{label}</p>
                          <p className="mt-0.5 text-[13px] font-black text-td-primary">{value}</p>
                        </div>
                      ))}
                      <div className="flex items-end gap-[2px]">
                        {stats.manaCurve.map((count, index) => (
                          <div key={index} className="flex min-w-0 flex-1 flex-col items-center justify-end">
                            <div className="w-full rounded-t-[1px] bg-td-accent" style={{ height: `${Math.max(2, (count / Math.max(1, ...stats.manaCurve)) * 17)}px` }} />
                            <span className="mt-0.5 text-[11px] text-td-secondary">{index === 7 ? "7+" : index}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {display === "text" ? (
                    <div
                      className={`${showStats ? "mt-2" : "mt-3"} grid min-h-0 flex-1 overflow-hidden rounded-xl border border-td-ink/[0.07] bg-black/25 p-4 text-td-primary`}
                      style={{
                        gridTemplateColumns: `repeat(${size === "story" ? 1 : 2}, minmax(0, 1fr))`,
                        gap: "1.5rem",
                      }}
                    >
                      {previewTextLanes.map((lane, laneIndex) => (
                        <div key={`text-lane-${laneIndex}`} className="min-w-0">
                          {lane.groups.map((group) => (
                            <section key={group.category} className="mb-3 w-full min-w-0">
                              <div className="mb-1.5 flex items-center justify-between rounded-md bg-td-accent/10 px-2.5 py-1.5">
                                <p className="text-[12px] font-black uppercase tracking-[0.05em] text-td-primary">{group.category}</p>
                                <span className="text-[11px] font-bold text-td-accent-text">{group.count}</span>
                              </div>
                              <div className="space-y-1">
                                {group.cards.map((card) => (
                                  <div key={card.id} className="grid grid-cols-[22px_minmax(0,1fr)_auto_auto] items-center gap-2 rounded px-1.5 py-0.5 hover:bg-td-ink/[0.04]">
                                    <span className="text-[11px] font-black text-td-secondary">{card.quantity}</span>
                                    <span className="truncate text-[11px] font-semibold text-td-accent-text">{card.name}</span>
                                    <span className="flex gap-0.5">
                                      {card.colors.slice(0, 4).map((color, index) => (
                                        <span
                                          key={`${card.id}-${color}-${index}`}
                                          className="h-3 w-3 rounded-full border border-td-ink/20"
                                          style={{ backgroundColor: { W: "#f5e8b6", U: "#38a8e8", B: "#8b7b9d", R: "#ef6351", G: "#43c985", C: "#cbd5e1" }[color] }}
                                        />
                                      ))}
                                    </span>
                                    <span className="min-w-[48px] text-right text-[11px] font-semibold text-td-primary">${(card.price * card.quantity).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </section>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                  <div
                    className={`${showStats ? "mt-2" : "mt-3"} grid min-h-0 flex-1 overflow-hidden`}
                    style={{
                      gridTemplateColumns: `repeat(${previewColumnCount}, minmax(0, 1fr))`,
                      gap: SHOWCASE_LAYOUT[size].previewGap,
                    }}
                  >
                    {previewLanes.map((lane, laneIndex) => (
                      <div key={`showcase-board-column-${laneIndex}`} className="min-w-0">
                        {lane.groups.map((group) => (
                          <section
                            key={group.category}
                            className="mb-2 w-full overflow-hidden rounded-lg border border-td-accent/10 bg-td-canvas/80 p-1.5 shadow-[0_8px_24px_rgb(var(--td-shadow-rgb)/calc(.18*var(--td-shadow-strength)))]"
                          >
                            <div className="mb-1 flex items-center justify-between rounded-[5px] bg-td-accent/10 px-2 py-1.5">
                              <p className="truncate text-[11px] font-black uppercase tracking-[0.055em] text-td-primary">
                                {group.category}
                              </p>
                              <span className="ml-2 text-[11px] font-black text-td-accent-text">{group.count}</span>
                            </div>
                            <div className="space-y-1">
                              {group.cards.map((card) => (
                                <div
                                  key={card.id}
                                  className="grid h-9 grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-md border border-td-ink/[0.06] bg-td-ink/[0.035] pr-2"
                                >
                                  <img
                                    src={card.image || `/api/deck-vault/card-image?name=${encodeURIComponent(card.name)}`}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    className="h-full w-full object-cover object-[center_28%]"
                                  />
                                  <span className="truncate text-[11px] font-bold text-td-primary">{card.name}</span>
                                  <span className="text-[11px] font-black text-td-accent-text">×{card.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    ))}
                  </div>
                  )}
                  <div className="mt-2 border-t border-td-ink/10 pt-2">
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-[0.13em] text-td-primary">Built in the Deck Vault</p>
                        <p className="mt-0.5 truncate text-[11px] font-semibold text-td-accent-text">{showLink ? publicUrl.replace(/^https?:\/\//, "") : "tradingdocks.com"}</p>
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
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-td-muted">{title}</p>
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
    <label className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-td-ink/[0.07] px-3 py-2.5 text-[11px] text-td-secondary">
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
          ? "border-td-accent/[0.16] bg-td-accent/[0.04] text-td-accent-text"
          : "border-transparent text-td-muted hover:border-td-ink/[0.055] hover:bg-td-ink/[0.015] hover:text-td-secondary",
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
            ? "text-td-accent-text"
            : "text-td-muted",
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
  previewing,
  onCheck,
  onSelect,
  onPreview,
  onPreviewEnd,
}: {
  card: DeckCard;
  checked: boolean;
  selected: boolean;
  previewing: boolean;
  onCheck: () => void;
  onSelect: () => void;
  onPreview: () => void;
  onPreviewEnd: () => void;
}) {
  const [imageFailed, setImageFailed] =
    useState(false);

  const imageSource = deckCardImageSource(card);

  useEffect(() => {
    setImageFailed(false);
  }, [imageSource]);

  return (
    <tr
      onClick={onSelect}
      onMouseEnter={onPreview}
      onMouseLeave={onPreviewEnd}
      className={[
        "cursor-pointer border-b border-td-ink/[0.045] transition odd:bg-td-ink/[0.006] last:border-b-0",
        selected
          ? "bg-td-accent/[0.07] shadow-[inset_3px_0_0_rgb(var(--td-accent-rgb)/.85),0_8px_18px_rgb(var(--td-shadow-rgb)/calc(.08*var(--td-shadow-strength)))]"
          : previewing
            ? "bg-td-accent/[0.04] shadow-[inset_3px_0_0_rgb(var(--td-accent-rgb)/.44)]"
          : "hover:bg-td-accent/[0.025]",
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

      <td className="px-3 py-2.5 text-[13px] font-semibold text-td-accent-text">
        {card.quantity}
      </td>

      <td className="min-w-0 px-3 py-2.5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          onMouseEnter={onPreview}
          onFocus={onPreview}
          onBlur={onPreviewEnd}
          className="group/name flex min-w-0 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-td-accent/50"
        >
          <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md border border-td-ink/[0.08] bg-td-canvas shadow-[0_7px_18px_rgb(var(--td-shadow-rgb)/calc(.3*var(--td-shadow-strength)))]">
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
            <p className="truncate text-[14px] font-semibold text-td-primary underline decoration-transparent underline-offset-4 transition group-hover/name:text-td-accent-text group-hover/name:decoration-cyan-300/40">
              {card.name}
            </p>
            <p className="mt-1 truncate text-[11px] text-td-muted">
              {card.category} · {card.typeLine}
            </p>
          </div>
        </button>
      </td>

      <td className="hidden truncate px-3 py-2.5 text-[12px] text-td-secondary 2xl:table-cell">
        {card.typeLine}
      </td>

      <td className="px-3 py-2.5 text-[13px] text-td-secondary">
        {card.manaValue}
      </td>

      <td className="px-3 py-2.5 text-[13px] font-semibold text-td-success">
        ${card.price.toFixed(2)}
      </td>

      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1.5">
          {card.owned ? (
            <span className="rounded-full border border-td-success/[0.1] bg-td-success/[0.025] px-2 py-1 text-[11px] text-td-success">
              Owned {Math.min(card.quantity, card.ownedQuantity ?? card.quantity)}/{card.quantity}
            </span>
          ) : (card.ownedQuantity ?? 0) > 0 ? (
            <span className="rounded-full border border-td-warning/[0.12] bg-td-warning/[0.035] px-2 py-1 text-[11px] text-td-warning">
              Partial {Math.min(card.quantity, card.ownedQuantity ?? 0)}/{card.quantity}
            </span>
          ) : (
            <span className="rounded-full border border-td-warning/[0.1] bg-td-warning/[0.025] px-2 py-1 text-[11px] text-td-warning">
              Missing
            </span>
          )}

          {card.legalityStatus &&
          card.legalityStatus !== "legal" ? (
            <span
              title={card.legalityMessage}
              className="rounded-full border border-td-danger/30 bg-td-danger/15 px-2 py-1 text-[11px] font-semibold text-td-danger"
            >
              {card.legalityStatus === "banned"
                ? "Banned"
                : "Illegal"}
            </span>
          ) : null}

          {card.gameChanger ? (
            <span className="rounded-full border border-td-violet/[0.12] bg-td-violet/[0.035] px-2 py-1 text-[11px] text-td-violet">
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

type DeckCardImageCandidate = {
  source: "direct" | "fallback-api";
  src: string;
};

type InspectorImageStatus =
  | "loading"
  | "loaded"
  | "failed";

const INSPECTOR_IMAGE_TIMEOUT_MS = 4500;
const deckInspectorImageCache = new Map<string, DeckCardImageCandidate>();

function deckCardImageIdentity(card: DeckCard) {
  return [
    card.id,
    card.name,
    card.setCode ?? "",
    card.collectorNumber ?? "",
    card.image ?? "",
  ].join("|");
}

function deckCardImageFallbackSource(card: DeckCard) {
  const params = new URLSearchParams({
    name: card.name,
  });

  if (card.setCode) {
    params.set("set", card.setCode);
    params.set("setCode", card.setCode);
  }

  if (card.collectorNumber) {
    params.set("collectorNumber", card.collectorNumber);
  }

  return `/api/deck-vault/card-image?${params.toString()}`;
}

function deckCardImageCandidates(card: DeckCard): DeckCardImageCandidate[] {
  const candidates: DeckCardImageCandidate[] = [];
  const directImage = card.image?.trim();

  if (directImage) {
    candidates.push({
      source: "direct",
      src: directImage,
    });
  }

  candidates.push({
    source: "fallback-api",
    src: deckCardImageFallbackSource(card),
  });

  return candidates;
}

function deckCardImageSource(card: DeckCard) {
  return deckCardImageCandidates(card)[0]?.src ?? "";
}

function InspectorCardImage({ card }: { card: DeckCard }) {
  const identityKey = deckCardImageIdentity(card);
  const candidates = useMemo(
    () => deckCardImageCandidates(card),
    [
      card.collectorNumber,
      card.id,
      card.image,
      card.name,
      card.setCode,
    ],
  );
  const cachedCandidate = deckInspectorImageCache.get(identityKey);
  const initialCandidateIndex = Math.max(
    0,
    candidates.findIndex(
      (candidate) => candidate.src === cachedCandidate?.src,
    ),
  );
  const [candidateIndex, setCandidateIndex] =
    useState(initialCandidateIndex);
  const [imageStatus, setImageStatus] =
    useState<InspectorImageStatus>(
      cachedCandidate ? "loaded" : "loading",
    );
  const activeImageRequestRef = useRef("");
  const imageCandidate = candidates[candidateIndex] ?? candidates[0];
  const imageSource = imageCandidate?.src ?? "";

  useEffect(() => {
    const nextCachedCandidate =
      deckInspectorImageCache.get(identityKey);
    const nextCandidateIndex = Math.max(
      0,
      candidates.findIndex(
        (candidate) => candidate.src === nextCachedCandidate?.src,
      ),
    );

    setCandidateIndex(nextCandidateIndex);
    setImageStatus(nextCachedCandidate ? "loaded" : "loading");
  }, [candidates, identityKey]);

  useEffect(() => {
    if (!imageSource || imageStatus === "loaded") {
      return;
    }

    const requestKey = `${identityKey}:${candidateIndex}:${imageSource}`;
    activeImageRequestRef.current = requestKey;

    const timeoutId = window.setTimeout(() => {
      if (activeImageRequestRef.current !== requestKey) {
        return;
      }

      setCandidateIndex((currentIndex) => {
        if (currentIndex < candidates.length - 1) {
          return currentIndex + 1;
        }

        setImageStatus("failed");
        return currentIndex;
      });
    }, INSPECTOR_IMAGE_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [
    candidateIndex,
    candidates.length,
    identityKey,
    imageSource,
    imageStatus,
  ]);

  function currentImageRequestKey(src: string) {
    return `${identityKey}:${candidateIndex}:${src}`;
  }

  function markImageLoaded(src: string) {
    if (!imageCandidate) {
      return;
    }

    if (
      activeImageRequestRef.current &&
      activeImageRequestRef.current !== currentImageRequestKey(src)
    ) {
      return;
    }

    deckInspectorImageCache.set(identityKey, imageCandidate);
    setImageStatus("loaded");
  }

  function markImageFailed(src: string) {
    if (
      activeImageRequestRef.current &&
      activeImageRequestRef.current !== currentImageRequestKey(src)
    ) {
      return;
    }

    setCandidateIndex((currentIndex) => {
      if (currentIndex < candidates.length - 1) {
        setImageStatus("loading");
        return currentIndex + 1;
      }

      setImageStatus("failed");
      return currentIndex;
    });
  }

  const failed = imageStatus === "failed";
  const loaded = imageStatus === "loaded";
  const showDiagnostics =
    process.env.NODE_ENV !== "production";

  return (
    <div className="relative mx-auto mb-4 aspect-[0.715] w-full max-w-[255px] overflow-hidden rounded-[22px] border border-td-ink/[0.095] bg-td-canvas shadow-[0_22px_70px_rgb(var(--td-shadow-rgb)/calc(0.42*var(--td-shadow-strength))),0_0_28px_rgb(var(--td-accent-rgb)/0.08)]">
      {!loaded && !failed ? (
        <div className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,rgb(var(--td-ink-rgb)/.025),rgb(var(--td-accent-rgb)/.08),rgb(var(--td-ink-rgb)/.025))]" />
      ) : null}
      {!failed && imageSource ? (
        <img
          key={imageSource}
          src={imageSource}
          alt={card.name}
          loading="eager"
          decoding="async"
          onLoad={() => markImageLoaded(imageSource)}
          onError={() => markImageFailed(imageSource)}
          className={[
            "h-full w-full object-contain transition duration-200",
            loaded ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <ImageIcon className="h-7 w-7 text-td-muted" />
          <p className="mt-3 text-[12px] font-semibold text-td-secondary">
            Card image unavailable
          </p>
          <p className="mt-1 text-[11px] leading-4 text-td-muted">
            {card.name}
          </p>
        </div>
      )}
      {showDiagnostics ? (
        <p className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-td-accent-text/70">
          {imageCandidate?.source ?? "none"} · {imageStatus}
        </p>
      ) : null}
    </div>
  );
}

function OwnershipLocations({ card }: { card: DeckCard }) {
  const matches = card.inventoryMatches ?? [];
  const ownedQuantity = card.ownedQuantity ?? 0;

  return (
    <div className="mt-4 rounded-xl border border-td-ink/[0.065] bg-black/[0.14] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-td-muted">
          Collection locations
        </p>
        <span className="text-[11px] font-semibold text-td-accent-text">
          {ownedQuantity} owned
        </span>
      </div>
      {matches.length ? (
        <div className="mt-2 space-y-2">
          {matches.map((match) => (
            <div
              key={match.inventoryId}
              className="flex items-start gap-2 rounded-lg border border-td-ink/[0.05] bg-td-ink/[0.018] px-2.5 py-2"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-td-violet" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-td-primary">
                  {inventoryLocationLabel(match)}
                </p>
                <p className="mt-0.5 text-[11px] text-td-muted">
                  {match.quantity} {match.quantity === 1 ? "copy" : "copies"}
                  {match.condition ? ` · ${match.condition}` : ""}
                  {match.printing ? ` · ${match.printing}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[11px] leading-4 text-td-muted">
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
  const imageSource = deckCardImageSource(card);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex w-full items-center gap-3 rounded-xl border border-td-ink/[0.05] bg-td-ink/[0.012] p-2 text-left transition hover:border-td-accent/[0.14] hover:bg-td-accent/[0.025]"
      >
        <img
          src={imageSource}
          alt={card.name}
          className="h-14 w-10 rounded-md object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-td-primary">
            {card.name}
          </p>
          <p className="mt-1 text-[11px] text-td-muted">
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
          className="pointer-events-none absolute left-full top-1/2 z-[80] ml-4 w-[220px] -translate-y-1/2 rounded-[20px] border border-td-accent/[0.14] bg-td-surface/98 p-3 shadow-[0_24px_70px_rgb(var(--td-shadow-rgb)/calc(0.58*var(--td-shadow-strength))),0_0_28px_rgb(var(--td-accent-rgb)/0.10)] backdrop-blur-xl"
        >
          <img
            src={imageSource}
            alt={card.name}
            className="aspect-[0.715] w-full rounded-2xl object-cover"
          />
          <p className="mt-3 text-[14px] font-semibold text-td-primary">
            {card.name}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-td-muted">
              MV {card.manaValue}
            </span>
            <span className="text-[12px] font-semibold text-td-success">
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

type ReplacementSuggestion = ScryfallCardResult & {
  score: number;
  reason: string;
};

type ReplacementPayload = {
  role: {
    label: string;
    explanation: string;
    signals: string[];
  };
  recommendations: ReplacementSuggestion[];
  error?: string;
};

function ReplacementFinder({
  card,
  format,
  deckColors,
  onClose,
  onReplace,
}: {
  card: DeckCard;
  format: DeckFormat;
  deckColors: ManaColor[];
  onClose: () => void;
  onReplace: (replacement: ScryfallCardResult) => void;
}) {
  const [payload, setPayload] =
    useState<ReplacementPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setPayload(null);

    void fetch("/api/deck-vault/replacements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        name: card.name,
        format,
        deckColors,
      }),
    })
      .then(async (response) => {
        const result = (await response.json()) as ReplacementPayload;
        if (!response.ok) {
          throw new Error(result.error || "No replacements could be found.");
        }
        setPayload(result);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(
          reason instanceof Error
            ? reason.message
            : "No replacements could be found.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [card.name, deckColors, format]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center bg-td-canvas/82 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Find a replacement for ${card.name}`}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section className="flex max-h-[90vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-[28px] border border-td-violet/[0.16] bg-td-surface shadow-[0_35px_120px_rgb(var(--td-shadow-rgb)/calc(.75*var(--td-shadow-strength))),0_0_55px_rgba(139,92,246,.11)]">
        <header className="flex items-start justify-between gap-5 border-b border-td-ink/[0.07] px-5 py-5 sm:px-7">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src={card.image || `/api/deck-vault/card-image?name=${encodeURIComponent(card.name)}`}
              alt=""
              className="h-[92px] w-[66px] shrink-0 rounded-lg object-cover shadow-xl"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-td-violet">
                Smart Replacement Finder
              </p>
              <h2 className="mt-1 truncate text-xl font-semibold text-td-primary">
                Replace {card.name}
              </h2>
              <p className="mt-1 text-[12px] text-td-muted">
                Only cards legal in {format}
                {deckColors.length
                  ? ` and within this deck’s ${deckColors.join("/")} color identity`
                  : " and colorless"}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-td-ink/[0.08] text-td-secondary transition hover:bg-td-ink/[0.05] hover:text-td-primary"
            aria-label="Close replacement finder"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {payload?.role ? (
          <div className="border-b border-td-ink/[0.06] bg-td-violet/[0.035] px-5 py-4 sm:px-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-td-violet/[0.18] bg-td-violet/[0.08] px-3 py-1 text-[11px] font-bold text-td-violet">
                {payload.role.label}
              </span>
              {payload.role.signals.map((signal) => (
                <span key={signal} className="rounded-full border border-td-ink/[0.07] px-2.5 py-1 text-[11px] text-td-muted">
                  {signal}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[12px] leading-5 text-td-secondary">
              {payload.role.explanation} Suggestions are ranked by role, card type, and mana-curve fit.
            </p>
          </div>
        ) : null}

        <div className="min-h-[280px] overflow-y-auto p-5 sm:p-7">
          {loading ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
              <WandSparkles className="h-7 w-7 animate-pulse text-td-violet" />
              <p className="mt-4 text-sm font-semibold text-td-primary">
                Analyzing this card’s deck-building role…
              </p>
              <p className="mt-2 text-xs text-td-muted">
                Checking format legality, color identity, function, and mana value.
              </p>
            </div>
          ) : error ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
              <AlertTriangle className="h-7 w-7 text-td-warning" />
              <p className="mt-4 text-sm font-semibold text-td-primary">{error}</p>
              <p className="mt-2 text-xs text-td-muted">
                Close this window and try the card again.
              </p>
            </div>
          ) : payload?.recommendations.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {payload.recommendations.map((suggestion) => (
                <article
                  key={suggestion.id}
                  className="group grid grid-cols-[76px_minmax(0,1fr)] gap-4 rounded-2xl border border-td-ink/[0.065] bg-black/[0.12] p-3 transition hover:border-td-violet/[0.2] hover:bg-td-violet/[0.025]"
                >
                  <img
                    src={suggestion.image}
                    alt={suggestion.name}
                    className="aspect-[0.715] w-[76px] rounded-lg object-cover shadow-lg"
                    loading="lazy"
                  />
                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-[14px] font-semibold text-td-primary group-hover:text-td-violet">
                          {suggestion.name}
                        </h3>
                        <p className="mt-1 truncate text-[11px] text-td-muted">
                          {suggestion.typeLine}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-td-success/[0.08] px-2 py-1 text-[11px] font-bold text-td-success">
                        {suggestion.score}% fit
                      </span>
                    </div>
                    <p className="mt-3 text-[11px] leading-4 text-td-secondary">
                      {suggestion.reason}
                    </p>
                    <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                      <span className="text-[11px] text-td-muted">
                        MV {suggestion.manaValue} · ${suggestion.price.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onReplace(suggestion)}
                        className="h-9 rounded-xl bg-td-violet px-3 text-[11px] font-bold text-td-on-accent transition hover:bg-td-violet"
                      >
                        Replace 1 copy
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[280px] items-center justify-center text-center text-sm text-td-muted">
              No legal alternatives matched this card’s role closely enough.
            </div>
          )}
        </div>
      </section>
    </div>
  );
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
      ? "border-td-accent/[0.12] bg-td-accent/[0.035] text-td-accent-text hover:border-td-accent/30 hover:bg-td-accent/[0.07]"
      : tone === "violet"
        ? "border-td-violet/[0.12] bg-td-violet/[0.035] text-td-violet hover:border-td-violet/30 hover:bg-td-violet/[0.07]"
        : "border-td-danger/[0.12] bg-td-danger/[0.035] text-td-danger hover:border-td-danger/30 hover:bg-td-danger/[0.07]",
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
    <div className="rounded-xl border border-td-ink/[0.055] bg-td-ink/[0.015] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-td-muted">
        {label}
      </p>
      <p className="mt-2 text-[16px] font-semibold text-td-primary">
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
    <div className="rounded-xl border border-td-ink/[0.055] bg-black/[0.08] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-td-muted">
        {label}
      </p>
      <p className="mt-1.5 text-[14px] font-semibold text-td-primary">
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
      ? "group-hover:shadow-[0_0_0_1px_rgba(244,63,94,0.8),0_0_34px_rgba(244,63,94,0.5),0_18px_50px_rgb(var(--td-shadow-rgb)/calc(0.5*var(--td-shadow-strength)))]"
      : card.gameChanger
        ? "group-hover:shadow-[0_0_0_1px_rgba(250,204,21,0.58),0_0_26px_rgba(250,204,21,0.28),0_18px_50px_rgb(var(--td-shadow-rgb)/calc(0.5*var(--td-shadow-strength)))]"
        : "group-hover:shadow-[0_0_0_1px_rgb(var(--td-accent-rgb)/0.58),0_0_18px_rgb(var(--td-accent-rgb)/0.28),0_0_34px_rgba(139,92,246,0.16),0_18px_50px_rgb(var(--td-shadow-rgb)/calc(0.5*var(--td-shadow-strength)))]";

  return (
    <article
      className={[
        "group relative isolate overflow-visible rounded-2xl border bg-black/[0.12] transition duration-300 hover:z-50 hover:-translate-y-3",
        glowClass,
        banned || formatIllegal || duplicateViolation
          ? "border-td-danger/[0.55]"
          : card.gameChanger
            ? "border-td-warning/[0.22]"
            : "border-td-ink/[0.07]",
        standalone
          ? "shadow-[0_20px_50px_rgba(76,29,149,0.22)]"
          : "",
      ].join(" ")}
    >
      <div
        className={[
          "relative aspect-[0.715] overflow-hidden rounded-t-2xl bg-td-surface transition duration-300 ease-out",
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
          <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-td-canvas to-td-accent/30 p-4 text-center">
            <span className="text-[11px] font-semibold text-td-secondary">
              {card.name}
            </span>
          </div>
        )}

        {issueLabel && !standalone ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-td-danger/92 p-4 text-center opacity-0 backdrop-blur-[2px] transition duration-200 group-hover:opacity-100">
            <div>
              <AlertTriangle className="mx-auto h-7 w-7 text-td-primary" />
              <p className="mt-3 text-[12px] font-black uppercase tracking-[0.08em] text-td-primary">
                {banned
                  ? "Banned in this format"
                  : formatIllegal
                    ? "Illegal in this format"
                    : "Deck construction error"}
              </p>
              <p className="mt-2 text-[11px] leading-4 text-td-danger">
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
              className="absolute right-2 top-2 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-td-ink/15 bg-black/75 text-white opacity-0 shadow-lg backdrop-blur transition hover:border-td-danger/30 hover:bg-td-danger/90 hover:text-td-danger group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : null}

        {card.gameChanger ? (
          <div className="absolute left-2 top-2 z-20 flex items-center gap-1 rounded-lg border border-td-warning/35 bg-gradient-to-r from-td-warning via-td-warning to-td-warning px-2 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-td-warning shadow-[0_0_20px_rgba(250,204,21,0.42)]">
            <Sparkles className="h-3 w-3" />
            Game Changer
          </div>
        ) : null}

        {!standalone ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent px-3 pb-3 pt-10 opacity-0 transition group-hover:opacity-100">
            <p className="text-center text-[11px] font-semibold text-td-primary">
              {card.name}
            </p>
            <p className="mt-1 text-center text-[11px] font-semibold text-td-accent-text">
              ${card.price.toFixed(2)}
            </p>
          </div>
        ) : null}
      </div>

      {!standalone ? (
        <div className="rounded-b-2xl border-t border-td-ink/[0.045] bg-[linear-gradient(180deg,rgb(var(--td-ink-rgb)/0.012),rgb(var(--td-shadow-rgb)/calc(0.06*var(--td-shadow-strength))))] px-2.5 py-2.5">
          <p className="line-clamp-2 min-h-7 text-center text-[11px] font-semibold leading-3.5 text-td-primary">
            {card.name}
          </p>

          <div className="mt-2 flex items-center justify-center gap-2">
            {card.quantity > 1 || basicLand ? (
              <span
                className={[
                  "rounded-md border px-2 py-1 text-[11px] font-semibold",
                  duplicateViolation
                    ? "border-td-danger/20 bg-td-danger/[0.08] text-td-danger"
                    : "border-td-accent/[0.12] bg-td-accent/[0.035] text-td-accent-text",
                ].join(" ")}
              >
                {card.quantity} copies
              </span>
            ) : (
              <span className="text-[11px] text-td-muted">
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
    <div className="rounded-xl border border-td-ink/[0.055] bg-black/[0.08] p-3">
      <p className="text-[11px] uppercase tracking-[0.1em] text-td-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-td-primary">
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
        "rounded-xl border p-3 text-[11px] leading-4",
        tone === "good"
          ? "border-td-success/[0.1] bg-td-success/[0.025] text-td-success"
          : "border-td-warning/[0.1] bg-td-warning/[0.025] text-td-warning",
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
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg border border-td-ink/[0.06] bg-td-canvas">
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

      <span className="w-8 text-center text-[11px] font-semibold text-td-accent-text">
        {card.quantity}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-td-primary">
          {card.name}
        </p>
        <p className="mt-1 text-[11px] text-td-muted">
          {card.typeLine}
        </p>
      </div>

      {card.gameChanger ? (
        <span className="rounded-lg border border-td-violet/[0.12] bg-td-violet/[0.035] px-2 py-1 text-[11px] font-semibold text-td-violet">
          Game Changer
        </span>
      ) : null}

      <span className="text-[11px] text-td-muted">
        ${card.price.toFixed(2)}
      </span>

      <button
        type="button"
        onClick={() => removeCard(card.id)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-td-danger/[0.1] text-td-danger"
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
  cards,
}: {
  report: DeckIntelligenceReport | null;
  loading: boolean;
  format: DeckFormat;
  cards: DeckCard[];
}) {
  const [combos, setCombos] = useState<DeckComboReport | null>(null);
  const [combosLoading, setCombosLoading] = useState(false);

  useEffect(() => {
    if (format !== "EDH" && format !== "Pauper EDH") {
      setCombos(null);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setCombosLoading(true);
      try {
        const inventory = await loadOwnedCollection();
        const response = await fetch("/api/deck-vault/combos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cards, format, inventory }),
        });
        const payload = (await response.json()) as DeckComboReport;
        if (!cancelled) setCombos(payload);
      } catch {
        if (!cancelled) {
          setCombos({
            available: false,
            complete: [],
            oneCardAway: [],
            summary: { complete: 0, oneCardAway: 0, ownedMissingPieces: 0, bracketSensitive: 0 },
            source: "Commander Spellbook",
            message: "Combo data is temporarily unavailable. Your other deck tools are unaffected.",
          });
        }
      } finally {
        if (!cancelled) setCombosLoading(false);
      }
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [format, cards]);

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
      <section className="relative overflow-hidden rounded-[30px] border border-td-accent/[0.13] bg-td-surface p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgb(var(--td-accent-rgb)/0.12),transparent_35%),radial-gradient(circle_at_90%_10%,rgba(139,92,246,0.10),transparent_32%)]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-td-accent-text">
              Live Deck Intelligence
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-td-primary">
              {format} Validation Center
            </h2>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-td-secondary">
              Format legality, copy limits, deck size, command-zone compatibility,
              token requirements, and inventory readiness update as the deck changes.
            </p>
          </div>

          <div className={[
            "rounded-2xl border px-5 py-4 text-center",
            report?.valid
              ? "border-td-success/[0.14] bg-td-success/[0.035]"
              : "border-td-danger/[0.18] bg-td-danger/[0.045]",
          ].join(" ")}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-td-muted">
              Deck Status
            </p>
            <p className={[
              "mt-2 text-2xl font-semibold",
              report?.valid
                ? "text-td-success"
                : "text-td-danger",
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

      {(format === "EDH" || format === "Pauper EDH") ? (
        <ComboIntelligence report={combos} loading={combosLoading} />
      ) : null}

      <section className="rounded-[28px] border border-td-ink/[0.07] bg-td-surface p-6">
        <h3 className="text-[20px] font-semibold text-td-primary">
          Validation Results
        </h3>
        <p className="mt-2 text-[13px] text-td-muted">
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
                    ? "border-td-danger/[0.16] bg-td-danger/[0.035]"
                    : "border-td-warning/[0.13] bg-td-warning/[0.03]",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={[
                    "mt-0.5 h-5 w-5 shrink-0",
                    issue.severity === "error"
                      ? "text-td-danger"
                      : "text-td-warning",
                  ].join(" ")} />
                  <div>
                    <p className="text-[14px] font-semibold text-td-primary">
                      {issue.cardName ?? "Deck construction"}
                    </p>
                    <p className="mt-2 text-[13px] leading-5 text-td-secondary">
                      {issue.message}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full rounded-2xl border border-td-success/[0.12] bg-td-success/[0.025] p-5 text-[14px] text-td-success">
              No format or command-zone issues were detected.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

function ComboIntelligence({
  report,
  loading,
}: {
  report: DeckComboReport | null;
  loading: boolean;
}) {
  const [view, setView] = useState<"complete" | "nearby">("complete");
  const selected = view === "complete" ? report?.complete ?? [] : report?.oneCardAway ?? [];

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-td-accent/[0.14] bg-td-surface p-6 sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_95%_0%,rgb(var(--td-accent-rgb)/0.13),transparent_34%),radial-gradient(circle_at_5%_100%,rgb(var(--td-accent-rgb)/0.10),transparent_38%)]" />
      <div className="relative">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-td-accent/20 bg-td-accent/[0.07]">
                <BrainCircuit className="h-4 w-4 text-td-accent-text" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-td-accent-text">Combo Intelligence</p>
            </div>
            <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.03em] text-td-primary">See the lines already hiding in your deck</h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-td-secondary">
              Verified Commander combos, exact execution steps, outcomes, and missing pieces matched against your Trading Docks inventory.
            </p>
          </div>
          <a href="https://commanderspellbook.com/" target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-td-muted transition hover:text-td-accent-text">
            Data by Commander Spellbook ↗
          </a>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ComboMetric label="Complete combos" value={report?.summary.complete ?? 0} tone="emerald" />
          <ComboMetric label="One card away" value={report?.summary.oneCardAway ?? 0} tone="cyan" />
          <ComboMetric label="Pieces you own" value={report?.summary.ownedMissingPieces ?? 0} tone="violet" />
          <ComboMetric label="Bracket-sensitive" value={report?.summary.bracketSensitive ?? 0} tone="amber" />
        </div>

        <div className="mt-6 flex w-fit gap-1 rounded-xl border border-td-ink/[0.07] bg-black/15 p-1">
          <button type="button" onClick={() => setView("complete")} className={["h-9 rounded-lg px-4 text-[11px] font-semibold transition", view === "complete" ? "bg-td-success text-td-on-accent" : "text-td-muted hover:text-td-primary"].join(" ")}>
            Active combos
          </button>
          <button type="button" onClick={() => setView("nearby")} className={["h-9 rounded-lg px-4 text-[11px] font-semibold transition", view === "nearby" ? "bg-td-accent text-td-on-accent" : "text-td-muted hover:text-td-primary"].join(" ")}>
            One card away
          </button>
        </div>

        {loading ? (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-td-ink/[0.06] bg-black/10 p-5 text-[13px] text-td-secondary">
            <RefreshCw className="h-4 w-4 animate-spin text-td-accent-text" /> Scanning verified combo lines…
          </div>
        ) : !report?.available ? (
          <div className="mt-5 rounded-2xl border border-td-warning/[0.12] bg-td-warning/[0.03] p-5 text-[13px] text-td-warning/80">
            {report?.message ?? "Combo analysis will appear when this Commander deck has cards."}
          </div>
        ) : selected.length ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {selected.map((combo) => <ComboCardView key={combo.id} combo={combo} nearComplete={view === "nearby"} />)}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-td-ink/[0.06] bg-black/10 p-5 text-[13px] text-td-muted">
            {view === "complete" ? "No complete verified combos were detected in this list." : "No legal one-card-away combos were found for this commander and color identity."}
          </div>
        )}
      </div>
    </section>
  );
}

function ComboMetric({ label, value, tone }: { label: string; value: number; tone: "emerald" | "cyan" | "violet" | "amber" }) {
  const styles = {
    emerald: "border-td-success/[0.12] bg-td-success/[0.035] text-td-success",
    cyan: "border-td-accent/[0.12] bg-td-accent/[0.035] text-td-accent-text",
    violet: "border-td-violet/[0.12] bg-td-violet/[0.035] text-td-violet",
    amber: "border-td-warning/[0.12] bg-td-warning/[0.035] text-td-warning",
  };
  return <div className={["rounded-2xl border p-4", styles[tone]].join(" ")}><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-td-muted">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>;
}

function ComboCardView({ combo, nearComplete }: { combo: DeckCombo; nearComplete: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const missing = combo.missingCards[0];
  return (
    <article className="rounded-[24px] border border-td-ink/[0.075] bg-td-surface/85 p-5 transition hover:border-td-accent/[0.15]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap gap-2">
          {combo.cards.map((card) => (
            <span key={card.name} className={["rounded-full border px-2.5 py-1.5 text-[11px] font-semibold", !card.inDeck ? "border-td-accent/20 bg-td-accent/[0.07] text-td-accent-text" : "border-td-ink/[0.08] bg-td-ink/[0.025] text-td-secondary"].join(" ")}>
              {!card.inDeck ? "+ " : ""}{card.name}{card.isCommander ? " · CZ" : ""}
            </span>
          ))}
        </div>
        <span className={["shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]", nearComplete ? "bg-td-accent/10 text-td-accent-text" : "bg-td-success/10 text-td-success"].join(" ")}>
          {nearComplete ? "1 missing" : "Live"}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {combo.produces.map((result) => <span key={result} className="rounded-lg border border-td-violet/[0.12] bg-td-violet/[0.035] px-2.5 py-1.5 text-[11px] font-semibold text-td-violet">{result}</span>)}
      </div>
      {missing ? (
        <div className="mt-4 rounded-xl border border-td-accent/[0.1] bg-td-accent/[0.025] p-3">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-td-muted">Missing piece</p><p className="mt-1 text-[13px] font-semibold text-td-primary">{missing.name}</p></div>
            {missing.ownedQuantity > 0 ? <span className="rounded-lg bg-td-success/10 px-2.5 py-1.5 text-[11px] font-semibold text-td-success">Owned ×{missing.ownedQuantity}</span> : <span className="text-[11px] text-td-muted">Not in inventory</span>}
          </div>
          {missing.inventoryLocations.length ? <p className="mt-2 text-[11px] text-td-muted">Located in {missing.inventoryLocations.join(" · ")}</p> : null}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-td-muted">
        {combo.manaNeeded ? <span>Setup mana {combo.manaNeeded}</span> : null}
        {combo.estimatedComboValue !== null ? <span>Combo value ~${combo.estimatedComboValue.toFixed(2)}</span> : null}
        {combo.popularity !== null ? <span>{combo.popularity.toLocaleString()} saves</span> : null}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-td-ink/[0.06] pt-4">
        <button type="button" onClick={() => setExpanded((value) => !value)} className="text-[11px] font-semibold text-td-accent-text">{expanded ? "Hide steps" : "How it works"}</button>
        <a href={combo.spellbookUrl} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-td-muted hover:text-td-primary">View verified combo ↗</a>
      </div>
      {expanded ? (
        <div className="mt-4 space-y-3 rounded-xl border border-td-ink/[0.06] bg-black/10 p-4">
          {combo.prerequisites.length ? <p className="text-[11px] leading-5 text-td-warning/80"><span className="font-semibold">Before you start:</span> {combo.prerequisites.join(" ")}</p> : null}
          <ol className="space-y-2">{combo.steps.map((step, index) => <li key={`${combo.id}-${index}`} className="flex gap-3 text-[11px] leading-5 text-td-secondary"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-td-accent/[0.08] text-[11px] font-semibold text-td-accent-text">{index + 1}</span><span>{step}</span></li>)}</ol>
        </div>
      ) : null}
    </article>
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
      <section className="rounded-[26px] border border-td-violet/[0.12] bg-td-surface p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-td-violet">
              Token Intelligence
            </p>
            <h2 className="mt-3 text-[28px] font-semibold text-td-primary">
              Complete token kit
            </h2>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-td-secondary">
              Only genuine token types enter the physical token kit. Multipliers,
              payoffs, copiers, and token consumers are classified separately.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-td-violet/[0.12] bg-td-violet/[0.035] px-5 py-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-td-muted">
                Unique tokens
              </p>
              <p className="mt-1 text-3xl font-semibold text-td-violet">
                {tokens.length}
              </p>
            </div>
            <div className="rounded-2xl border border-td-accent/[0.12] bg-td-accent/[0.035] px-5 py-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-td-muted">
                Support cards
              </p>
              <p className="mt-1 text-3xl font-semibold text-td-accent-text">
                {support.length}
              </p>
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-td-ink/[0.06] bg-td-surface p-6 text-[14px] text-td-muted">
          Classifying token producers and support cards…
        </div>
      ) : (
        <>
          <section className="rounded-[26px] border border-td-ink/[0.07] bg-td-surface p-5">
            <div>
              <p className="text-[18px] font-semibold text-td-primary">
                Required Token Kit
              </p>
              <p className="mt-1 text-[12px] text-td-muted">
                Bring one physical card for each unique token below. Use dice or counters for additional copies.
              </p>
            </div>

            {tokens.length ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {tokens.map((token) => (
                  <article
                    key={token.name}
                    className="group overflow-hidden rounded-[22px] border border-td-ink/[0.07] bg-black/[0.09] transition duration-200 hover:-translate-y-0.5 hover:border-td-violet/[0.16] hover:shadow-[0_18px_50px_rgb(var(--td-shadow-rgb)/calc(0.28*var(--td-shadow-strength))),0_0_24px_rgba(139,92,246,0.08)]"
                  >
                    <div className="relative aspect-[1.55] overflow-hidden bg-td-violet/[0.03]">
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
                            <Sparkles className="mx-auto h-7 w-7 text-td-violet" />
                            <p className="mt-3 text-[12px] font-semibold text-td-violet">
                              {token.name}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="absolute left-3 top-3 rounded-full border border-td-ink/[0.12] bg-td-surface/88 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-td-violet backdrop-blur">
                        Required Token
                      </div>
                    </div>

                    <div className="p-4">
                      <h3 className="text-[17px] font-semibold text-td-primary">
                        {token.name}
                      </h3>

                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-td-muted">
                        Created by
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {token.createdBy.map(
                          (name) => (
                            <span
                              key={name}
                              className="rounded-full border border-td-ink/[0.06] bg-td-ink/[0.015] px-2.5 py-1.5 text-[11px] leading-4 text-td-secondary"
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
              <div className="mt-5 rounded-2xl border border-td-ink/[0.06] bg-black/[0.08] p-5 text-[13px] text-td-muted">
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
                className="rounded-[26px] border border-td-ink/[0.07] bg-td-surface p-5"
              >
                <div>
                  <p className="text-[18px] font-semibold text-td-primary">
                    {group.title}
                  </p>
                  <p className="mt-1 text-[12px] text-td-muted">
                    {group.description}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.cards.map((card) => (
                    <article
                      key={`${group.role}-${card.cardName}`}
                      className="rounded-2xl border border-td-ink/[0.06] bg-td-ink/[0.015] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[14px] font-semibold text-td-primary">
                          {card.cardName}
                        </p>
                        <span className="rounded-full border border-td-accent/[0.1] bg-td-accent/[0.025] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-td-accent-text">
                          {card.role}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] leading-5 text-td-muted">
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
      <section className="rounded-[30px] border border-td-success/[0.11] bg-td-surface p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-td-success">
          Inventory Intelligence
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-td-primary">
          Know what you own, where it is, and where it is listed.
        </h2>
        <p className="mt-3 max-w-4xl text-[14px] leading-6 text-td-secondary">
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

      <section className="overflow-hidden rounded-[26px] border border-td-ink/[0.07] bg-td-surface">
        <div className="border-b border-td-ink/[0.055] px-5 py-4">
          <h3 className="text-[18px] font-semibold text-td-primary">
            Ownership Map
          </h3>
        </div>

        <div className="divide-y divide-td-ink/[0.045]">
          {loading ? (
            <p className="p-5 text-[13px] text-td-muted">
              Checking inventory…
            </p>
          ) : rows.map((row) => (
            <div
              key={row.cardId}
              className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(180px,1fr)_100px_100px_2fr]"
            >
              <div>
                <p className="text-[14px] font-semibold text-td-primary">
                  {row.cardName}
                </p>
                <p className="mt-1 text-[11px] text-td-muted">
                  Need {row.required}
                </p>
              </div>
              <p className={[
                "text-[13px] font-semibold",
                row.owned >= row.required
                  ? "text-td-success"
                  : "text-td-warning",
              ].join(" ")}>
                {row.owned} owned
              </p>
              <p className="text-[13px] text-td-secondary">
                {row.matches.length} locations
              </p>
              <div className="flex flex-wrap gap-2">
                {row.matches.length ? row.matches.map((match) => (
                  <InventoryMatchChip
                    key={match.inventoryId}
                    match={match}
                  />
                )) : (
                  <span className="rounded-full border border-td-warning/[0.1] bg-td-warning/[0.025] px-3 py-1.5 text-[11px] text-td-warning">
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
    <span className="rounded-xl border border-td-ink/[0.065] bg-td-ink/[0.015] px-3 py-2 text-[11px] text-td-secondary">
      <strong className="text-td-primary">
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
    cyan: "border-td-accent/[0.11] bg-td-accent/[0.025] text-td-accent-text",
    rose: "border-td-danger/[0.12] bg-td-danger/[0.03] text-td-danger",
    amber: "border-td-warning/[0.11] bg-td-warning/[0.025] text-td-warning",
    emerald: "border-td-success/[0.11] bg-td-success/[0.025] text-td-success",
  }[tone];

  return (
    <div className={[
      "rounded-[22px] border p-5",
      tones,
    ].join(" ")}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-75">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-td-primary">
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
      <section className="relative overflow-hidden rounded-[30px] border border-td-accent/[0.12] bg-td-surface p-6 shadow-[0_30px_90px_rgb(var(--td-shadow-rgb)/calc(0.28*var(--td-shadow-strength)))] sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgb(var(--td-accent-rgb)/0.10),transparent_33%),radial-gradient(circle_at_82%_20%,rgba(139,92,246,0.09),transparent_30%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgb(var(--td-accent-rgb)/0.018)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--td-accent-rgb)/0.018)_1px,transparent_1px)] bg-[size:34px_34px]" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-td-accent/[0.16] bg-td-accent/[0.05] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-td-accent-text">
                Deck Intelligence
              </span>
              <span className="text-[12px] text-td-muted">
                Live analysis
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-td-primary sm:text-4xl">
              {commanderName || deck.name}
            </h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-td-secondary">
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

      <section className="rounded-[28px] border border-td-success/[0.11] bg-td-surface p-6">
        <div className="grid gap-6 xl:grid-cols-[190px_minmax(0,1fr)] xl:items-center">
          <div className="rounded-2xl border border-td-success/[0.12] bg-td-success/[0.03] p-5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-success">
              Deck Readiness
            </p>
            <p className="mt-3 text-5xl font-semibold text-td-primary">
              {readinessScore}%
            </p>
            <p className="mt-2 text-[12px] text-td-muted">
              Ready for the deck box
            </p>
          </div>

          <div>
            <h2 className="text-[20px] font-semibold text-td-primary">
              Pre-game readiness checklist
            </h2>
            <p className="mt-2 text-[13px] leading-5 text-td-muted">
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
                <div className="flex h-40 items-end gap-3 rounded-2xl border border-td-ink/[0.045] bg-black/[0.08] px-4 pt-4">
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
                        <span className="text-[12px] font-semibold text-td-primary">
                          {item.value}
                        </span>
                        <div
                          className="w-full max-w-[44px] rounded-t-xl border border-td-accent/[0.1] bg-gradient-to-t from-td-accent via-td-accent to-td-accent shadow-[0_0_20px_rgb(var(--td-accent-rgb)/0.10)] transition duration-300 group-hover:shadow-[0_0_30px_rgb(var(--td-accent-rgb)/0.26)]"
                          style={{ height }}
                        />
                        <span className="pb-2 text-[11px] text-td-muted">
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

          <section className="rounded-[28px] border border-td-ink/[0.07] bg-td-surface p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[18px] font-semibold text-td-primary">
                  Current Deck List
                </p>
                <p className="mt-1 text-[13px] text-td-muted">
                  Preview the current construction or return to the full editor.
                </p>
              </div>
              <button
                type="button"
                onClick={openCards}
                className="h-11 rounded-xl bg-gradient-to-r from-td-accent to-td-accent px-5 text-[13px] font-semibold text-td-on-accent shadow-[0_0_24px_rgb(var(--td-accent-rgb)/0.14)] transition hover:brightness-110"
              >
                Open Deck Editor
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {mainDeckCards.slice(0, 8).map((card) => (
                <div
                  key={card.id}
                  className="flex items-center gap-3 rounded-2xl border border-td-ink/[0.06] bg-td-ink/[0.015] p-3 transition hover:border-td-accent/[0.13]"
                >
                  {card.image ? (
                    <img
                      src={card.image}
                      alt={card.name}
                      className="h-16 w-12 rounded-lg object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-td-primary">
                      {card.name}
                    </p>
                    <p className="mt-1 text-[11px] text-td-muted">
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
          <section className="rounded-[28px] border border-td-violet/[0.12] bg-td-surface p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-td-violet/[0.15] bg-td-violet/[0.05]">
                <BrainCircuit className="h-5 w-5 text-td-violet" />
              </div>
              <div>
                <p className="text-[18px] font-semibold text-td-primary">
                  AI Deck Review
                </p>
                <p className="mt-1 text-[12px] text-td-muted">
                  Format-aware strategic profile
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-td-violet/[0.11] bg-td-violet/[0.025] p-5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-td-muted">
                {isCommander
                  ? "Commander Bracket"
                  : "Deck Health"}
              </p>
              <p className="mt-2 text-5xl font-semibold text-td-violet">
                {isCommander
                  ? bracket.bracket
                  : Math.round(healthScore)}
              </p>
              <p className="mt-2 text-[14px] font-semibold text-td-violet">
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
                <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-td-warning">
                  Game Changers
                </p>
                <div className="mt-3 space-y-2">
                  {bracket.gameChangers.map((name) => (
                    <div
                      key={name}
                      className="rounded-xl border border-td-warning/[0.1] bg-td-warning/[0.025] px-4 py-3 text-[13px] text-td-warning"
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
                  className="rounded-xl border border-td-ink/[0.05] bg-td-ink/[0.015] p-4 text-[13px] leading-5 text-td-secondary"
                >
                  {reason}
                </p>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-td-success/[0.1] bg-td-surface p-6">
            <p className="text-[18px] font-semibold text-td-primary">
              Collection Status
            </p>
            <p className="mt-1 text-[12px] text-td-muted">
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

            <button className="mt-5 h-12 w-full rounded-xl bg-gradient-to-r from-td-success to-td-accent text-[13px] font-semibold text-td-on-accent transition hover:brightness-110">
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


function CleanColorIdentity({
  colors,
  compact = false,
}: {
  colors: ManaColor[];
  compact?: boolean;
}) {
  const identity = displayCommanderColors(colors);
  const shown = identity.length ? identity : (["C"] as ManaColor[]);

  return (
    <div
      className={[
        "inline-flex items-center rounded-full border border-td-ink/[0.08] bg-td-canvas/88",
        compact ? "gap-1 px-1.5 py-1" : "gap-1.5 px-2 py-1.5",
      ].join(" ")}
      aria-label={`Color identity: ${shown.map(manaName).join(", ")}`}
    >
      {shown.map((color) => (
        <span
          key={color}
          className={[
            "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-td-ink/[0.14] bg-td-canvas shadow-[0_2px_7px_rgb(var(--td-shadow-rgb)/calc(.4*var(--td-shadow-strength)))]",
            compact ? "h-5 w-5" : "h-6 w-6",
          ].join(" ")}
          title={manaName(color)}
        >
          <img
            src={manaSymbolUrl(color)}
            alt=""
            className="h-[92%] w-[92%] object-contain"
          />
        </span>
      ))}
    </div>
  );
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
            "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-td-ink/15 bg-td-canvas shadow-[0_2px_8px_rgb(var(--td-shadow-rgb)/calc(0.38*var(--td-shadow-strength)))]",
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
  return `/mana/${symbol}.svg`;
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

  const maxCount = Math.max(
    ...cardCounts.map((entry) => entry.count),
    1,
  );
  const highestDemand = cardCounts.reduce(
    (highest, entry) =>
      entry.count > highest.count ? entry : highest,
    cardCounts[0],
  );

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-td-ink/[0.055] bg-black/[0.08] px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-td-muted">
            Demand profile
          </p>
          <p className="mt-1 text-[13px] text-td-secondary">
            Relative color presence across the deck
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-td-success/[0.12] bg-td-success/[0.035] px-3 py-2">
          <ManaSymbols colors={[highestDemand.color]} size="sm" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-td-success/70">
              Highest
            </p>
            <p className="text-[12px] font-semibold text-td-primary">
              {manaName(highestDemand.color)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5" role="img" aria-label="Color demand by cards">
          {cardCounts.map((entry) => {
            const percentage =
              (entry.count / total) * 100;
            const relativeWidth =
              entry.count === 0
                ? 0
                : Math.max(8, (entry.count / maxCount) * 100);

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
                  "group flex w-full min-w-0 items-start gap-3 rounded-2xl px-4 py-3.5 text-left transition duration-300",
                  activeColor ===
                  entry.color
                    ? "bg-td-ink/[0.045] shadow-[0_12px_30px_rgb(var(--td-shadow-rgb)/calc(0.18*var(--td-shadow-strength)))] ring-1 ring-td-ink/[0.10]"
                    : "bg-td-ink/[0.018] ring-1 ring-td-ink/[0.045]",
                ].join(" ")}
              >
                <ManaSymbols
                  colors={[entry.color]}
                  size="sm"
                />

                <div className="min-w-0 flex-1">
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-td-primary">
                        {manaName(entry.color)}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-td-secondary">
                        {entry.count} {entry.count === 1 ? "card" : "cards"}
                      </p>
                    </div>
                    <p className="text-right text-[13px] font-semibold tabular-nums text-td-primary">
                      {percentage.toFixed(0)}%
                    </p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-td-ink/[0.055]">
                    <div
                      className="h-full rounded-full transition-all duration-500 group-hover:brightness-110"
                      style={{
                        width: `${relativeWidth}%`,
                        background: `linear-gradient(90deg, ${palette[entry.color]}99, ${palette[entry.color]})`,
                        boxShadow: `0 0 18px ${palette[entry.color]}33`,
                      }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-td-ink/[0.055] pt-4 text-[11px] text-td-muted">
        <span>Percentages include multicolor cards in each matching color.</span>
        <span className="shrink-0 font-semibold text-td-secondary">{total} color matches</span>
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
            deckColors: Array.from(new Set(cards.flatMap((card) => card.colors)))
              .filter((color) => color !== "C"),
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
    <section className="relative overflow-hidden rounded-[30px] border border-td-accent/[0.14] bg-td-surface p-6 shadow-[0_28px_80px_rgb(var(--td-shadow-rgb)/calc(0.24*var(--td-shadow-strength)))] sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-td-violet/[0.15] bg-td-violet/[0.05]">
            <BrainCircuit className="h-5 w-5 text-td-violet" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[20px] font-semibold text-td-primary">
                AI Deck Doctor
              </h2>
              {report ? (
                <span className="rounded-full border border-td-accent/[0.12] bg-td-accent/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-td-accent-text">
                  {report.analysisMode === "ai"
                    ? "AI + Scryfall"
                    : "Rules + Scryfall"}
                </span>
              ) : null}
            </div>
            <p className="mt-2 max-w-3xl text-[13px] leading-5 text-td-secondary">
              Detects structural gaps, validates candidates against format and color identity,
              then ranks cards for draw, ramp, interaction, protection, finishers, and combo support.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void runReview()}
          disabled={loading}
          className="h-11 rounded-xl border border-td-accent/[0.18] bg-td-accent/[0.05] px-5 text-[13px] font-semibold text-td-accent-text transition hover:bg-td-accent/[0.09] disabled:cursor-wait disabled:opacity-50"
        >
          {loading ? "Analyzing…" : "Run New Review"}
        </button>
      </div>

      {error ? (
        <div className="mt-5 rounded-xl border border-td-danger/[0.12] bg-td-danger/[0.035] p-4 text-[13px] text-td-danger">
          {error}
        </div>
      ) : null}

      {loading && !report ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl border border-td-ink/[0.05] bg-td-ink/[0.02]"
            />
          ))}
        </div>
      ) : null}

      {report ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-[150px_1fr]">
            <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-td-violet/[0.11] bg-td-violet/[0.025] text-center">
              <p className="text-4xl font-semibold text-td-violet">
                {report.score}
              </p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.11em] text-td-muted">
                Deck Health
              </p>
            </div>
            <div className="rounded-2xl border border-td-ink/[0.06] bg-td-ink/[0.015] p-4">
              <p className="text-[14px] leading-6 text-td-secondary">
                {report.summary}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {report.strengths.map((strength) => (
                  <span
                    key={strength}
                    className="rounded-full border border-td-success/[0.11] bg-td-success/[0.025] px-3 py-2 text-[11px] text-td-success"
                  >
                    {strength}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-td-secondary">
              Issues detected
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {report.issues.map((issue) => (
                <div
                  key={`${issue.role}-${issue.target}`}
                  className="rounded-2xl border border-td-ink/[0.06] bg-td-ink/[0.015] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[14px] font-semibold text-td-primary">
                      {issue.role}
                    </p>
                    <span
                      className={[
                        "rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]",
                        issue.severity === "high"
                          ? "bg-td-danger/[0.1] text-td-danger"
                          : issue.severity === "medium"
                            ? "bg-td-warning/[0.1] text-td-warning"
                            : "bg-td-accent/[0.08] text-td-accent-text",
                      ].join(" ")}
                    >
                      {issue.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] text-td-secondary">
                    Current {issue.current} · Target {issue.target}
                  </p>
                  <p className="mt-2 text-[12px] leading-5 text-td-muted">
                    {issue.explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-td-secondary">
              Recommended cards
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {report.recommendations.map((recommendation) => (
                <article
                  key={`${recommendation.role}-${recommendation.cardName}`}
                  className="flex gap-3 rounded-2xl border border-td-ink/[0.06] bg-td-ink/[0.015] p-3 transition hover:border-td-accent/[0.14] hover:bg-td-accent/[0.02]"
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
                        <p className="text-[14px] font-semibold text-td-primary">
                          {recommendation.cardName}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-td-accent-text">
                          {recommendation.role}
                        </p>
                      </div>
                      <span className="rounded-full border border-td-ink/[0.06] px-2.5 py-1.5 text-[11px] text-td-secondary">
                        {recommendation.confidence}%
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] leading-5 text-td-secondary">
                      {recommendation.reason}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-[11px] text-td-muted">
                        Solves: {recommendation.issue}
                      </span>
                      {typeof recommendation.price === "number" ? (
                        <span className="text-[12px] font-semibold text-td-success">
                          ${recommendation.price.toFixed(2)}
                        </span>
                      ) : null}
                    </div>
                    {recommendation.replacement ? (
                      <p className="mt-2 text-[11px] text-td-warning/80">
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
    <div className="min-w-[112px] rounded-xl border border-td-ink/[0.08] bg-black/35 p-3 backdrop-blur">
      <p className="text-[11px] uppercase tracking-[0.1em] text-td-muted">
        {label}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-td-primary">
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
        ? "border-td-success/[0.1] bg-td-success/[0.025]"
        : "border-td-warning/[0.11] bg-td-warning/[0.025]",
    ].join(" ")}>
      <div className="flex min-w-0 items-center gap-2">
        {ready ? (
          <CheckCircle2 className="h-4 w-4 text-td-success" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-td-warning" />
        )}
        <p className="text-[12px] font-semibold text-td-primary">
          {label}
        </p>
      </div>
      <p className="mt-2 text-[11px] text-td-muted">
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
    cyan: "border-td-accent/[0.12] bg-td-accent/[0.035] text-td-accent-text",
    violet: "border-td-violet/[0.12] bg-td-violet/[0.035] text-td-violet",
    emerald: "border-td-success/[0.12] bg-td-success/[0.035] text-td-success",
    amber: "border-td-warning/[0.12] bg-td-warning/[0.035] text-td-warning",
  }[tone];

  return (
    <div
      className={[
        "min-w-[132px] rounded-2xl border p-4 backdrop-blur",
        toneClass,
      ].join(" ")}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-70">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-td-primary">
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
    <div className="rounded-[24px] border border-td-ink/[0.07] bg-td-surface p-5">
      <Icon className="h-5 w-5 text-td-accent-text" />
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.11em] text-td-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-td-primary">
        {value}
      </p>
      <p className="mt-2 text-[12px] text-td-muted">
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
    <section className="rounded-[28px] border border-td-ink/[0.07] bg-td-surface p-6 shadow-[inset_0_1px_0_rgb(var(--td-ink-rgb)/0.018)]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-td-accent/[0.1] bg-td-accent/[0.035]">
          <Icon className="h-5 w-5 text-td-accent-text" />
        </div>
        <div>
          <p className="text-[18px] font-semibold text-td-primary">
            {title}
          </p>
          <p className="mt-1 text-[12px] text-td-muted">
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
            <span className="font-medium text-td-secondary">
              {item.label}
            </span>
            <span className="font-semibold text-td-primary">
              {item.value} cards
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-td-ink/[0.045]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-td-accent to-td-violet"
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
    <div className="flex items-center justify-between rounded-xl border border-td-ink/[0.05] bg-td-ink/[0.015] px-3 py-3 text-[11px]">
      <span className="text-td-muted">
        {label}
      </span>
      <span
        className={
          tone === "good"
            ? "text-td-success"
            : "text-td-warning"
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
    <div className="rounded-xl border border-td-ink/[0.055] bg-black/[0.08] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-td-muted">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-td-primary">
        {value}
      </p>
    </div>
  );
}
