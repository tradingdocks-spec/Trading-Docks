import { supabase } from '../lib/supabase.ts';
import type { DeckRecord } from './mobile-deck-vault-model.ts';

export {
  analyzeMobileDeck,
  colorIdentityLabel,
  formatDeckValue,
  summarizeMobileDeckVault,
  type DeckCard,
  type DeckRecord,
  type ManaColor,
  type MobileDeckAnalytics,
  type MobileDeckSummary,
} from './mobile-deck-vault-model.ts';

export type MobileDeckVaultResult = {
  decks: DeckRecord[];
  stale: boolean;
  unavailableReason?: string;
};

type DeckRow = {
  deck_data: DeckRecord | null;
};

export async function loadMobileDeckVault(): Promise<MobileDeckVaultResult> {
  if (!supabase) {
    return {
      decks: [],
      stale: false,
      unavailableReason: 'Deck Vault is unavailable until Supabase is configured for this build.',
    };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (authError || !userId) {
    return {
      decks: [],
      stale: false,
      unavailableReason: 'Sign in to load your Deck Vault.',
    };
  }

  const { data, error } = await supabase
    .from('deck_vault_decks')
    .select('deck_data')
    .eq('user_id', userId)
    .not('deck_data', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    return {
      decks: [],
      stale: false,
      unavailableReason: error.message.includes('deck_vault_decks')
        ? 'Deck Vault database support is not installed for this environment.'
        : error.message,
    };
  }

  const decks = ((data ?? []) as DeckRow[])
    .map((row) => row.deck_data)
    .filter(isDeckRecord)
    .sort((a, b) => deckTimestamp(b.updatedAt) - deckTimestamp(a.updatedAt));

  return { decks, stale: false };
}

function isDeckRecord(value: DeckRecord | null): value is DeckRecord {
  return Boolean(
    value &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.cards),
  );
}

function deckTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
