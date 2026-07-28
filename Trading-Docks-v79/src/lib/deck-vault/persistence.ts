import { accountStorageKey } from "@/lib/account-storage";
import {
  deleteAccountDocument,
  loadAccountDocument,
  saveAccountDocument,
} from "@/lib/account-documents";
import type { DeckRecord } from "@/lib/deck-vault/types";

const LIST_KEY = "deck-vault:list";
const DECK_PREFIX = "deck-vault:deck:";
const UNRESOLVED_PREFIX = "deck-vault:unresolved:";

export async function loadDeckVault(): Promise<DeckRecord[]> {
  let ids = await loadAccountDocument<string[]>(LIST_KEY);
  if (ids === null) ids = await migrateLegacyDecks();

  const decks = await Promise.all(ids.map((id) => loadAccountDocument<DeckRecord>(deckKey(id))));
  return decks.filter((deck): deck is DeckRecord => Boolean(deck));
}

export async function loadDeckRecord(deckId: string) {
  const cloudDeck = await loadAccountDocument<DeckRecord>(deckKey(deckId));
  if (cloudDeck) return cloudDeck;
  await migrateLegacyDecks();
  return loadAccountDocument<DeckRecord>(deckKey(deckId));
}

export async function saveDeckRecord(deck: DeckRecord, unresolved?: unknown[]) {
  const ids = (await loadAccountDocument<string[]>(LIST_KEY)) ?? [];
  await Promise.all([
    saveAccountDocument(deckKey(deck.id), deck),
    saveAccountDocument(LIST_KEY, [deck.id, ...ids.filter((id) => id !== deck.id)]),
    saveAccountDocument("deck-vault:last-saved", deck.id),
    unresolved?.length
      ? saveAccountDocument(`${UNRESOLVED_PREFIX}${deck.id}`, unresolved)
      : Promise.resolve(),
  ]);
}

export async function deleteDeckRecord(deckId: string) {
  const ids = (await loadAccountDocument<string[]>(LIST_KEY)) ?? [];
  await Promise.all([
    deleteAccountDocument(deckKey(deckId)),
    deleteAccountDocument(`${UNRESOLVED_PREFIX}${deckId}`),
    saveAccountDocument(LIST_KEY, ids.filter((id) => id !== deckId)),
  ]);
}

function deckKey(deckId: string) {
  return `${DECK_PREFIX}${deckId}`;
}

async function migrateLegacyDecks() {
  if (typeof window === "undefined") return [];
  const legacyListKey = await accountStorageKey("trading-docks-imported-decks");
  const ids = safeParse<string[]>(window.localStorage.getItem(legacyListKey), []);

  for (const id of ids) {
    const legacyDeckKey = await accountStorageKey(`trading-docks-deck:${id}`);
    const deck = safeParse<DeckRecord | null>(window.localStorage.getItem(legacyDeckKey), null);
    if (deck) await saveAccountDocument(deckKey(id), deck);

    const legacyUnresolvedKey = await accountStorageKey(`trading-docks-unresolved:${id}`);
    const unresolved = safeParse<unknown[] | null>(
      window.localStorage.getItem(legacyUnresolvedKey),
      null,
    );
    if (unresolved) await saveAccountDocument(`${UNRESOLVED_PREFIX}${id}`, unresolved);
    window.localStorage.removeItem(legacyDeckKey);
    window.localStorage.removeItem(legacyUnresolvedKey);
  }

  await saveAccountDocument(LIST_KEY, ids);
  window.localStorage.removeItem(legacyListKey);
  return ids;
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
