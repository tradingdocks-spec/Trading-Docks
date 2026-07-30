import { accountStorageKey } from "@/lib/account-storage";
import {
  loadAccountDocument,
  saveAccountDocument,
} from "@/lib/account-documents";
import type { DeckRecord } from "@/lib/deck-vault/types";
import { createClient } from "@/lib/supabase/client";

const LIST_KEY = "deck-vault:list";
const DECK_PREFIX = "deck-vault:deck:";
const UNRESOLVED_PREFIX = "deck-vault:unresolved:";

export async function loadDeckVault(): Promise<DeckRecord[]> {
  const { supabase, userId } = await authenticatedClient();
  const { data, error } = await supabase
    .from("deck_vault_decks")
    .select("deck_data")
    .eq("user_id", userId)
    .not("deck_data", "is", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw deckStorageError("Decks could not be loaded", error.message);
  }

  if (data.length) {
    return data.map((row) => row.deck_data as DeckRecord);
  }

  const legacyDecks = await loadLegacyDeckVault();
  for (const deck of legacyDecks) {
    await saveDeckRow(deck);
  }
  return legacyDecks;
}

export async function loadDeckRecord(deckId: string) {
  const { supabase, userId } = await authenticatedClient();
  const { data, error } = await supabase
    .from("deck_vault_decks")
    .select("deck_data")
    .eq("user_id", userId)
    .eq("deck_key", deckId)
    .maybeSingle();

  if (error) {
    throw deckStorageError("The deck could not be loaded", error.message);
  }
  if (data) return data.deck_data as DeckRecord;

  const legacyDeck = await loadAccountDocument<DeckRecord>(deckKey(deckId));
  if (legacyDeck) {
    await saveDeckRow(legacyDeck);
    return legacyDeck;
  }
  return null;
}

export async function saveDeckRecord(deck: DeckRecord, unresolved?: unknown[]) {
  const saveToken = crypto.randomUUID();
  const deckWithSaveToken = {
    ...deck,
    accountSaveToken: saveToken,
  } as DeckRecord & { accountSaveToken: string };
  await saveDeckRow(deckWithSaveToken, unresolved);

  const saved = (await loadDeckRecord(deck.id)) as
    | (DeckRecord & { accountSaveToken?: string })
    | null;
  if (
    !saved ||
    saved.id !== deck.id ||
    saved.accountSaveToken !== saveToken ||
    saved.cards.length !== deck.cards.length
  ) {
    throw new Error("Trading Docks could not verify that this deck was saved. Please try again.");
  }
}

export async function deleteDeckRecord(deckId: string) {
  void deckId;
  throw new Error(
    "Deck deletion is disabled. Your saved decks remain attached to your Trading Docks account.",
  );
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
}

async function authenticatedClient() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Your session expired. Sign in again before saving this deck.");
  return { supabase, userId: user.id };
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
