import { accountStorageKey } from "../account-storage";
import {
  loadAccountDocument,
  saveAccountDocument,
} from "../account-documents";
import type { DeckRecord } from "./types";
import { createClient } from "../supabase/client";

const LIST_KEY = "deck-vault:list";
const DECK_PREFIX = "deck-vault:deck:";
const UNRESOLVED_PREFIX = "deck-vault:unresolved:";
const RECOVERY_PREFIX = "deck-vault:recovery:";

type RecoveryDeck = {
  deck: DeckRecord;
  savedAt: number;
  pending: boolean;
};

type DeckDataRow = {
  deck_data: DeckRecord;
};

export async function loadDeckVault(): Promise<DeckRecord[]> {
  const { supabase, userId } = await authenticatedClient();
  const { data, error } = await supabase
    .from("deck_vault_decks")
    .select("deck_data")
    .eq("user_id", userId)
    .not("deck_data", "is", null)
    .order("updated_at", { ascending: false });

  if (error) {
    const recovered = loadRecoveryDecks(userId);
    if (recovered.length) return recovered;
    throw deckStorageError("Decks could not be loaded", error.message);
  }

  const rows = (data ?? []) as DeckDataRow[];
  if (rows.length) {
    const remoteDecks: DeckRecord[] = rows.map((row) => row.deck_data);
    const recovered = loadRecoveryDecks(userId);
    const merged = new Map(remoteDecks.map((deck) => [deck.id, deck]));
    for (const item of recovered) {
      const cached = loadRecoveryDeck(userId, item.id);
      if (cached?.pending) {
        merged.set(item.id, cached.deck);
      }
    }
    return Array.from(merged.values());
  }

  const recovered = loadRecoveryDecks(userId);
  if (recovered.length) return recovered;

  const legacyDecks = await loadLegacyDeckVault();
  for (const deck of legacyDecks) {
    await saveDeckRow(deck);
  }
  return legacyDecks;
}

export async function loadDeckRecord(deckId: string) {
  const { supabase, userId } = await authenticatedClient();
  const recovery = loadRecoveryDeck(userId, deckId);
  const { data, error } = await supabase
    .from("deck_vault_decks")
    .select("deck_data")
    .eq("user_id", userId)
    .eq("deck_key", deckId)
    .maybeSingle();

  if (error) {
    if (recovery) return recovery.deck;
    throw deckStorageError("The deck could not be loaded", error.message);
  }
  if (data) {
    const remote = data.deck_data as DeckRecord;
    return recovery?.pending
      ? recovery.deck
      : remote;
  }
  if (recovery) return recovery.deck;

  const legacyDeck = await loadAccountDocument<DeckRecord>(deckKey(deckId));
  if (legacyDeck) {
    await saveDeckRow(legacyDeck);
    return legacyDeck;
  }
  return null;
}

export async function saveDeckRecord(deck: DeckRecord, unresolved?: unknown[]) {
  // The upsert already returns and validates the account/deck keys. Avoid
  // immediately reading the entire deck back after every autosave.
  await saveDeckRow(deck, unresolved);
}

export async function deleteDeckRecord(deckId: string) {
  const { supabase, userId } = await authenticatedClient();
  const { error } = await supabase
    .from("deck_vault_decks")
    .delete()
    .eq("user_id", userId)
    .eq("deck_key", deckId);
  if (error) throw deckStorageError("The deck could not be deleted", error.message);
  removeRecoveryDeck(userId, deckId);
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

async function loadLegacyDeckVault(): Promise<DeckRecord[]> {
  let ids = await loadAccountDocument<string[]>(LIST_KEY);
  if (ids === null) ids = await migrateLegacyDecks();
  const decks = await Promise.all(ids.map((id) => loadAccountDocument<DeckRecord>(deckKey(id))));
  return decks.filter((deck): deck is DeckRecord => Boolean(deck));
}

async function saveDeckRow(deck: DeckRecord, unresolved?: unknown[]) {
  const { supabase, userId } = await authenticatedClient();
  saveRecoveryDeck(userId, deck);
  const { data, error } = await supabase.from("deck_vault_decks").upsert(
    {
      user_id: userId,
      deck_key: deck.id,
      name: deck.name,
      format: deck.format,
      commander: deck.commander ?? null,
      deck_data: deck,
      unresolved_cards: unresolved ?? [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,deck_key" },
  ).select("user_id,deck_key").single();
  if (error) throw deckStorageError("The deck could not be saved", error.message);
  if (!data || data.user_id !== userId || data.deck_key !== deck.id) {
    throw new Error("The deck could not be saved: the account write was not confirmed.");
  }
  saveRecoveryDeck(userId, deck, false);
}

function recoveryKey(userId: string, deckId: string) {
  return `${RECOVERY_PREFIX}${userId}:${deckId}`;
}

function saveRecoveryDeck(userId: string, deck: DeckRecord, pending = true) {
  if (typeof window === "undefined") return;
  const payload: RecoveryDeck = { deck, savedAt: Date.now(), pending };
  window.localStorage.setItem(recoveryKey(userId, deck.id), JSON.stringify(payload));
}

function loadRecoveryDeck(userId: string, deckId: string): RecoveryDeck | null {
  if (typeof window === "undefined") return null;
  return safeParse<RecoveryDeck | null>(
    window.localStorage.getItem(recoveryKey(userId, deckId)),
    null,
  );
}

function loadRecoveryDecks(userId: string): DeckRecord[] {
  if (typeof window === "undefined") return [];
  const prefix = `${RECOVERY_PREFIX}${userId}:`;
  const decks: DeckRecord[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const recovery = safeParse<RecoveryDeck | null>(
      window.localStorage.getItem(key),
      null,
    );
    if (recovery?.deck) decks.push(recovery.deck);
  }
  return decks;
}

function removeRecoveryDeck(userId: string, deckId: string) {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(recoveryKey(userId, deckId));
  }
}

async function authenticatedClient() {
  const supabase = createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.user) {
    throw new Error("Your session expired. Sign in again before saving this deck.");
  }
  return { supabase, userId: session.user.id };
}

function deckStorageError(prefix: string, message: string) {
  if (message.includes("deck_vault_decks")) {
    return new Error(`${prefix}: the Deck Vault database update has not been installed.`);
  }
  return new Error(`${prefix}: ${message}`);
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
