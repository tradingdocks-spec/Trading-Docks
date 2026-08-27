import { MOBILE_CANONICAL_SITE_URL } from './mobile-release-config.ts';
import type { ScannerSessionLine } from './continuous-offer-scanner.ts';
import { addCards, applyDeckChangeProposal } from '../../src/lib/deckmaster/actions.ts';
import type { DeckCard, DeckRecord } from './mobile-deck-vault-model.ts';

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

export type ScannerDeckMutationResult =
  | { ok: true; deckId: string; deckName: string; cardName: string; quantity: number }
  | { ok: false; error: string; deckId: string; deckName: string; recoverable: true };

type DeckRow = {
  deck_data: DeckRecord | null;
};

export async function loadMobileDeckVault(): Promise<MobileDeckVaultResult> {
  const supabase = await getSupabase();
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

export async function addScannerCardsToMobileDeck(input: {
  deckId: string;
  deckName?: string | null;
  lines: ScannerSessionLine[];
  fetchImpl?: typeof fetch;
  loadDeckRecordImpl?: (deckId: string) => Promise<DeckRecord | null>;
  saveDeckRecordImpl?: (deck: DeckRecord) => Promise<void>;
}) : Promise<ScannerDeckMutationResult[]> {
  const { loadDeckRecord: defaultLoadDeck, saveDeckRecord: defaultSaveDeck } = input.loadDeckRecordImpl && input.saveDeckRecordImpl
    ? { loadDeckRecord: input.loadDeckRecordImpl, saveDeckRecord: input.saveDeckRecordImpl }
    : await import('../../src/lib/deck-vault/persistence.ts');
  const loadDeck = input.loadDeckRecordImpl ?? defaultLoadDeck;
  const saveDeck = input.saveDeckRecordImpl ?? defaultSaveDeck;
  const deck = await loadDeck(input.deckId);
  if (!deck) {
    return input.lines.map((line) => failureResult(input.deckId, input.deckName ?? line.deckName ?? 'Deck', line.cardName, `The deck "${input.deckName ?? line.deckName ?? 'Deck'}" could not be found.`));
  }

  const outcomes: ScannerDeckMutationResult[] = [];
  const cardCache = new Map<string, DeckCard>();
  let workingDeck = deck;

  for (const line of input.lines) {
    const deckName = input.deckName ?? line.deckName ?? deck.name;
    try {
      const card = await resolveScannerDeckCard(line, workingDeck, input.fetchImpl ?? fetch, cardCache);
      const proposal = addCards(workingDeck, [{ card, quantity: line.quantity, reason: 'Stored from scanner session.' }], `Add ${line.quantity} ${card.name} to ${deckName}.`);
      if (!proposal.legality.canApply) {
        throw new Error(proposal.legality.introducedIssues.map((issue) => issue.message).join(' '));
      }
      workingDeck = applyDeckChangeProposal(workingDeck, proposal);
      await saveDeck(workingDeck);
      outcomes.push({ ok: true, deckId: workingDeck.id, deckName: workingDeck.name, cardName: card.name, quantity: line.quantity });
    } catch (error) {
      outcomes.push(failureResult(input.deckId, input.deckName ?? deck.name, line.cardName, error instanceof Error ? error.message : 'Deck assignment needs retry.'));
    }
  }

  return outcomes;
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

async function resolveScannerDeckCard(
  line: ScannerSessionLine,
  deck: DeckRecord,
  fetchImpl: typeof fetch,
  cache: Map<string, DeckCard>,
) {
  const cacheKey = [line.cardName, line.setCode ?? '', line.collectorNumber ?? ''].join('|');
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const queryParts = [`!"${line.cardName.replaceAll('"', '\\"')}"`];
  if (line.setCode) queryParts.push(`set:${line.setCode}`);
  if (line.collectorNumber) queryParts.push(`number:${line.collectorNumber}`);
  const url = `${MOBILE_CANONICAL_SITE_URL}/api/deck-vault/card-search?${new URLSearchParams({ q: queryParts.join(' ') }).toString()}`;
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Deck Vault card lookup failed.');
  const payload = await response.json() as { results?: ScryfallCard[] };
  const results = (payload.results ?? []).filter((card) => card?.id && card?.name);
  if (!results.length) throw new Error(`No deck card could be resolved for ${line.cardName}.`);

  const exact = results.find((card) =>
    normalize(card.name) === normalize(line.cardName) &&
    (!line.setCode || normalize(card.setCode) === normalize(line.setCode)) &&
    (!line.collectorNumber || normalize(card.collectorNumber) === normalize(line.collectorNumber)),
  ) ?? results.find((card) => normalize(card.name) === normalize(line.cardName)) ?? results[0];

  const card = toDeckCard(exact, deck, line);
  cache.set(cacheKey, card);
  return card;
}

function toDeckCard(card: ScryfallCard, deck: DeckRecord, line: ScannerSessionLine): DeckCard {
  const board = inferBoard(deck, card.name);
  const colors = card.colorIdentity.length ? card.colorIdentity : card.colors;
  return {
    id: card.id,
    name: card.name,
    quantity: line.quantity,
    manaValue: card.manaValue,
    colors: colors.length ? colors : ['C'],
    typeLine: card.typeLine || 'Card',
    category: categoryForTypeLine(card.typeLine),
    price: Number.isFinite(card.price) ? card.price : 0,
    owned: true,
    image: card.image || undefined,
    artCrop: card.artCrop || undefined,
    setCode: card.setCode || undefined,
    collectorNumber: card.collectorNumber || undefined,
    board,
    legalityStatus: card.legalities?.[deckFormatLegalityKey(deck.format)] ?? undefined,
    ownedQuantity: line.quantity,
  };
}

function inferBoard(deck: DeckRecord, cardName: string): DeckCard['board'] {
  const commanderNames = [deck.commander, ...(deck.commanders ?? [])].filter((value): value is string => Boolean(value));
  if (commanderNames.some((name) => normalize(name) === normalize(cardName))) return 'commander';
  return 'main';
}

function deckFormatLegalityKey(format: DeckRecord['format']) {
  const normalized = String(format).toLowerCase();
  if (normalized === 'edh' || normalized === 'pauper edh') return 'commander';
  if (normalized === 'standard') return 'standard';
  if (normalized === 'modern') return 'modern';
  if (normalized === 'pioneer') return 'pioneer';
  if (normalized === 'legacy') return 'legacy';
  if (normalized === 'vintage') return 'vintage';
  if (normalized === 'pauper') return 'pauper';
  return 'commander';
}

function categoryForTypeLine(typeLine: string) {
  const lower = typeLine.toLowerCase();
  if (lower.includes('creature')) return 'Creature';
  if (lower.includes('instant')) return 'Instant';
  if (lower.includes('sorcery')) return 'Sorcery';
  if (lower.includes('artifact')) return 'Artifact';
  if (lower.includes('enchantment')) return 'Enchantment';
  if (lower.includes('planeswalker')) return 'Planeswalker';
  if (lower.includes('land')) return 'Land';
  return 'Other';
}

function failureResult(deckId: string, deckName: string, cardName: string, error: string): ScannerDeckMutationResult {
  return { ok: false, deckId, deckName, recoverable: true, error: `${cardName}: ${error}` };
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

async function getSupabase() {
  const module = await import('../lib/supabase.ts');
  return module.supabase;
}

type ScryfallCard = {
  id: string;
  name: string;
  manaValue: number;
  colors: DeckCard['colors'];
  colorIdentity: DeckCard['colors'];
  typeLine: string;
  setCode: string;
  collectorNumber: string;
  image: string;
  artCrop: string;
  price: number;
  legalities?: Record<string, DeckCard['legalityStatus']>;
};
