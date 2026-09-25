import {
  MEMBERSHIP_PLANS,
  normalizeMembershipTier,
} from './membership-catalog.ts';
import type { InventoryCommand } from './inventory-command.ts';
import {
  normalizeCardCondition,
  normalizeCardFinish,
  normalizeTradeBinderStatus,
  type CardCondition,
  type CardFinish,
  type TradeBinderStatus,
} from './collector-workspace.ts';

export type ScannerPermissionState = 'not_requested' | 'granted' | 'denied' | 'unavailable';
export type ScannerRecognitionMode = 'unavailable' | 'manual_search' | 'assisted_capture';
export type ScannerWorkflowState = 'idle' | 'permission_needed' | 'searching' | 'selecting_printing' | 'confirming' | 'saving' | 'success' | 'error' | 'offline';
export type ScannerGameId = 'magic' | 'pokemon';
export type ScannerProductType = 'card' | 'sealed';

export type ScannerRecognitionProvider = {
  id: string;
  label: string;
  mode: ScannerRecognitionMode;
  supportsImageCapture: boolean;
  retainsImagesByDefault: false;
  recognize(input: ScannerRecognitionInput): Promise<ScannerRecognitionResult>;
};

export type ScannerRecognitionInput = {
  query?: string;
  imageUri?: string | null;
  cachedCandidates?: ScannerCardCandidate[];
  online: boolean;
};

export type ScannerCardCandidate = {
  id: string;
  gameId?: ScannerGameId;
  gameLabel?: string;
  productType?: ScannerProductType;
  providerCategoryId?: string | null;
  tcgplayerProductId?: number | null;
  tcgplayerSkuId?: number | null;
  providerProductId?: string | null;
  providerSkuId?: string | null;
  providerSource?: 'scryfall' | 'tcgplayer' | 'tcgtracking' | 'visual_index' | 'multiple' | null;
  providerSources?: string[];
  providerIds?: Record<string, string | number>;
  identityAuthority?: 'provider_confirmed' | 'synthetic_fallback' | null;
  oracleId?: string | null;
  name: string;
  setCode: string | null;
  setName: string | null;
  collectorNumber: string | null;
  finishes: CardFinish[];
  language: string | null;
  variant?: string | null;
  imageUrl?: string | null;
  confidence: number;
  recognitionMode: ScannerRecognitionMode;
  marketPrice?: ScannerCandidateMarketPrice | null;
  specialPrintingLabels?: string[];
  scryfallMetadata?: ScannerCandidateScryfallMetadata | null;
};

export type ScannerCandidateMarketPrice = {
  usd: number | null;
  usdFoil: number | null;
  usdEtched: number | null;
  source: 'scryfall';
  fetchedAt: string | null;
};

export type ScannerCandidateScryfallMetadata = {
  releasedAt?: string | null;
  setType?: string | null;
  promo?: boolean;
  promoTypes?: string[];
  frameEffects?: string[];
  layout?: string | null;
};

export type ScannerRecognitionResult =
  | { ok: true; candidates: ScannerCardCandidate[]; assisted: boolean; warning?: string }
  | { ok: false; reason: string; offline?: boolean };

export type ScannerConfirmation = {
  userId: string;
  candidate: ScannerCardCandidate;
  quantity: number;
  condition: CardCondition;
  finish: CardFinish;
  language: string | null;
  storageLocationId: string | null;
  binderPage?: number | null;
  binderSlot?: string | null;
  tradeStatus: Exclude<TradeBinderStatus, 'unknown'>;
  addToWishlist: boolean;
};

export type ScannerValidationContext = {
  membershipTier: unknown;
  currentTotalQuantity: number;
};

export type ScannerValidationResult =
  | { ok: true }
  | { ok: false; code: 'invalid_quantity' | 'free_limit' | 'invalid_printing' | 'invalid_condition' | 'invalid_finish'; reason: string };

export type ScannerDraft = {
  userId: string;
  query: string;
  selectedCandidateId: string | null;
  confirmation: Omit<ScannerConfirmation, 'userId' | 'candidate'> | null;
  updatedAt: string;
};

export type ScannerAddPayload = {
  id: string;
  user_id: string;
  game_id: ScannerGameId;
  product_type: ScannerProductType;
  provider_category_id: string | null;
  provider_product_id: string | null;
  provider_sku_id: string | null;
  tcgplayer_product_id: number | null;
  tcgplayer_sku_id: number | null;
  variant: string | null;
  language: string | null;
  card_name: string;
  scryfall_id: string | null;
  set_code: string | null;
  collector_number: string | null;
  quantity: number;
  location_id: string | null;
  data: Record<string, unknown>;
};

export const SCANNER_COLLECTION_QUEUE_TYPE = 'collector_scanner_collection_add';
export const SCANNER_DRAFT_KEY_PREFIX = 'trading-docks-scanner-draft-v1';

export function scannerDraftKey(userId: string) {
  return `${SCANNER_DRAFT_KEY_PREFIX}:${userId}`;
}

export function resolveScannerPermissionState({
  cameraAvailable,
  permissionGranted,
  permissionDenied,
  requested,
}: {
  cameraAvailable: boolean;
  permissionGranted?: boolean;
  permissionDenied?: boolean;
  requested?: boolean;
}): ScannerPermissionState {
  if (!cameraAvailable) return 'unavailable';
  if (permissionGranted) return 'granted';
  if (permissionDenied) return 'denied';
  return requested ? 'denied' : 'not_requested';
}

export function validateScannerConfirmation(
  confirmation: ScannerConfirmation,
  context: ScannerValidationContext,
): ScannerValidationResult {
  if (!confirmation.candidate.id || !confirmation.candidate.name.trim()) {
    return { ok: false, code: 'invalid_printing', reason: 'Select an exact printing before adding to Collection.' };
  }
  if (!Number.isInteger(confirmation.quantity) || confirmation.quantity <= 0) {
    return { ok: false, code: 'invalid_quantity', reason: 'Quantity must be a whole number above zero.' };
  }
  if (normalizeCardCondition(confirmation.condition) !== confirmation.condition) {
    return { ok: false, code: 'invalid_condition', reason: 'Choose a supported condition.' };
  }
  if (normalizeCardFinish(confirmation.finish) !== confirmation.finish) {
    return { ok: false, code: 'invalid_finish', reason: 'Choose a supported finish.' };
  }
  const plan = MEMBERSHIP_PLANS[normalizeMembershipTier(context.membershipTier)];
  if (plan.limits.cardLimit !== null && context.currentTotalQuantity + confirmation.quantity > plan.limits.cardLimit) {
    return {
      ok: false,
      code: 'free_limit',
      reason: `Free plan collections are limited to ${plan.limits.cardLimit} cards.`,
    };
  }
  return { ok: true };
}

export function buildScannerAddPayload(confirmation: ScannerConfirmation, id: string): ScannerAddPayload {
  const scryfallId = confirmedScryfallId(confirmation.candidate);
  const gameId = normalizeScannerGameId(confirmation.candidate.gameId ?? confirmation.candidate.providerCategoryId);
  const gameLabel = confirmation.candidate.gameLabel ?? scannerGameLabel(gameId);
  const productType = normalizeScannerProductType(confirmation.candidate.productType);
  const variant = confirmation.candidate.variant ?? confirmation.finish;
  return {
    id,
    user_id: confirmation.userId,
    game_id: gameId,
    product_type: productType,
    provider_category_id: confirmation.candidate.providerCategoryId ?? (gameId === 'magic' ? '1' : gameId === 'pokemon' ? '3' : null),
    provider_product_id: confirmation.candidate.providerProductId ?? null,
    provider_sku_id: confirmation.candidate.providerSkuId ?? null,
    tcgplayer_product_id: confirmation.candidate.tcgplayerProductId ?? null,
    tcgplayer_sku_id: confirmation.candidate.tcgplayerSkuId ?? null,
    variant,
    language: confirmation.language,
    card_name: confirmation.candidate.name,
    scryfall_id: scryfallId,
    set_code: confirmation.candidate.setCode,
    collector_number: confirmation.candidate.collectorNumber,
    quantity: confirmation.quantity,
    location_id: confirmation.storageLocationId,
    data: {
      name: confirmation.candidate.name,
      gameId,
      game_id: gameId,
      gameLabel,
      productType,
      product_type: productType,
      scryfallId,
      tcgplayerProductId: confirmation.candidate.tcgplayerProductId ?? null,
      tcgplayerSkuId: confirmation.candidate.tcgplayerSkuId ?? null,
      tcgplayer_sku_id: confirmation.candidate.tcgplayerSkuId ?? null,
      providerCategoryId: confirmation.candidate.providerCategoryId ?? null,
      provider_category_id: confirmation.candidate.providerCategoryId ?? null,
      providerProductId: confirmation.candidate.providerProductId ?? null,
      providerSkuId: confirmation.candidate.providerSkuId ?? null,
      provider_sku_id: confirmation.candidate.providerSkuId ?? null,
      providerSource: confirmation.candidate.providerSource ?? null,
      providerSources: confirmation.candidate.providerSources ?? [],
      providerIds: confirmation.candidate.providerIds ?? {},
      canonicalCardId: confirmation.candidate.oracleId ?? null,
      exactPrintingId: confirmation.candidate.id,
      identityAuthority: confirmation.candidate.identityAuthority ?? null,
      set: confirmation.candidate.setCode,
      setName: confirmation.candidate.setName,
      collectorNumber: confirmation.candidate.collectorNumber,
      finish: confirmation.finish,
      variant,
      condition: confirmation.condition,
      language: confirmation.language,
      imageUrl: confirmation.candidate.imageUrl ?? null,
      locationId: confirmation.storageLocationId,
      binderPage: confirmation.binderPage ?? null,
      binderSlot: confirmation.binderSlot ?? null,
      scannerAddedAt: new Date().toISOString(),
      scannerRecognitionMode: confirmation.candidate.recognitionMode,
    },
  };
}

/** Called once after authoritative resolution; replay uses its persisted output. */
export function buildScannerInventoryCommand(confirmation: ScannerConfirmation, operationId: string, workspaceId: string, createdAt: string): InventoryCommand {
  const payload = { ...buildScannerAddPayload(confirmation, operationId), workspace_id: workspaceId };
  payload.data.scannerAddedAt = createdAt;
  return { version: 1, operationId, userId: confirmation.userId, workspaceId, createdAt,
    inventoryItemId: operationId, endpoint: 'create_inventory_item_with_event',
    args: { p_inventory: payload, p_source: 'scanner', p_idempotency_key: operationId,
      p_related_entity_type: 'scanner_confirmation', p_related_entity_id: operationId } };
}

/** Detect edits to a queued intent without treating price/recognition UI as stock. */
export function scannerIntentFingerprint(c: ScannerConfirmation) {
  return JSON.stringify({ user: c.userId, printing: c.candidate.id, game: c.candidate.gameId ?? null,
    providerIds: Object.entries(c.candidate.providerIds ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    quantity: c.quantity, condition: c.condition, finish: c.finish, language: c.language,
    location: c.storageLocationId, binderPage: c.binderPage ?? null, binderSlot: c.binderSlot ?? null,
    tradeStatus: c.tradeStatus, wishlist: c.addToWishlist });
}

export function scannerQueueKey(confirmation: ScannerConfirmation) {
  const candidate = confirmation.candidate;
  const gameId = normalizeScannerGameId(candidate.gameId ?? candidate.providerCategoryId);
  const productType = normalizeScannerProductType(candidate.productType);
  const identity = [
    gameId,
    productType,
    candidate.tcgplayerSkuId ?? candidate.providerSkuId ?? candidate.tcgplayerProductId ?? candidate.providerProductId ?? candidate.id,
    candidate.variant ?? confirmation.finish,
    confirmation.language ?? candidate.language ?? 'unknown-language',
  ].join(':');
  return `${confirmation.userId}:${identity}:${confirmation.condition}:${confirmation.storageLocationId ?? 'unassigned'}:${confirmation.binderPage ?? 'no-page'}:${confirmation.binderSlot ?? 'no-slot'}`;
}

export function scannerIdempotencyKey(confirmation: ScannerConfirmation, inventoryItemId: string) {
  return `${scannerQueueKey(confirmation)}:${inventoryItemId}`;
}

export function resetAfterRapidScan() {
  return {
    query: '',
    selectedCandidateId: null,
    confirmation: null,
    state: 'idle' as ScannerWorkflowState,
  };
}

export function createInterruptedScanDraft(input: {
  userId: string;
  query: string;
  selectedCandidateId?: string | null;
  confirmation?: Omit<ScannerConfirmation, 'userId' | 'candidate'> | null;
}): ScannerDraft {
  return {
    userId: input.userId,
    query: input.query,
    selectedCandidateId: input.selectedCandidateId ?? null,
    confirmation: input.confirmation ?? null,
    updatedAt: new Date().toISOString(),
  };
}

export function scannerPrivacySummary() {
  return {
    uploadsImagesWithoutIntent: false,
    retainsPhotosByDefault: false,
    localDraftStoresImage: false,
    message: 'Trading Docks does not retain card photos by default and does not upload captured images without a clear scan action.',
  };
}

export function normalizeScannerCandidate(raw: {
  id?: unknown;
  gameId?: unknown;
  gameLabel?: unknown;
  productType?: unknown;
  providerCategoryId?: unknown;
  tcgplayerProductId?: unknown;
  tcgplayerSkuId?: unknown;
  providerProductId?: unknown;
  providerSkuId?: unknown;
  providerSource?: unknown;
  providerSources?: unknown;
  providerIds?: unknown;
  identityAuthority?: unknown;
  oracleId?: unknown;
  name?: unknown;
  setCode?: unknown;
  setName?: unknown;
  collectorNumber?: unknown;
  finishes?: unknown;
  language?: unknown;
  variant?: unknown;
  imageUrl?: unknown;
  confidence?: unknown;
  recognitionMode?: unknown;
  marketPrice?: ScannerCandidateMarketPrice | null;
  specialPrintingLabels?: unknown;
  scryfallMetadata?: ScannerCandidateScryfallMetadata | null;
}): ScannerCardCandidate | null {
  const id = stringValue(raw.id);
  const name = stringValue(raw.name);
  if (!id || !name) return null;
  const finishes = Array.isArray(raw.finishes)
    ? raw.finishes.map((finish) => finish === 'nonfoil' ? 'normal' : normalizeCardFinish(finish)).filter((finish) => finish !== 'unknown')
    : [];
  return {
    id,
    gameId: normalizeScannerGameId(raw.gameId ?? raw.providerCategoryId),
    gameLabel: scannerGameLabel(raw.gameLabel ?? raw.gameId ?? raw.providerCategoryId),
    productType: normalizeScannerProductType(raw.productType),
    providerCategoryId: stringValue(raw.providerCategoryId),
    tcgplayerProductId: numberValue(raw.tcgplayerProductId),
    tcgplayerSkuId: numberValue(raw.tcgplayerSkuId),
    providerProductId: stringValue(raw.providerProductId),
    providerSkuId: stringValue(raw.providerSkuId),
    providerSource: raw.providerSource === 'tcgtracking' || raw.providerSource === 'tcgplayer' || raw.providerSource === 'visual_index' || raw.providerSource === 'multiple' ? raw.providerSource : raw.providerSource === 'scryfall' ? 'scryfall' : null,
    providerSources: Array.isArray(raw.providerSources) ? raw.providerSources.map(stringValue).filter((value): value is string => Boolean(value)).slice(0, 6) : [],
    providerIds: normalizeProviderIds(raw.providerIds),
    identityAuthority: raw.identityAuthority === 'provider_confirmed' || raw.identityAuthority === 'synthetic_fallback' ? raw.identityAuthority : null,
    oracleId: stringValue(raw.oracleId),
    name,
    setCode: stringValue(raw.setCode)?.toUpperCase() ?? null,
    setName: stringValue(raw.setName) ?? null,
    collectorNumber: stringValue(raw.collectorNumber) ?? null,
    finishes: finishes.length ? [...new Set(finishes)] : ['normal'],
    language: stringValue(raw.language) ?? 'en',
    variant: stringValue(raw.variant),
    imageUrl: stringValue(raw.imageUrl),
    confidence: typeof raw.confidence === 'number' && Number.isFinite(raw.confidence) ? Math.max(0, Math.min(1, raw.confidence)) : 0,
    recognitionMode: raw.recognitionMode === 'assisted_capture' ? 'assisted_capture' : 'manual_search',
    marketPrice: normalizeCandidateMarketPrice(raw.marketPrice),
    specialPrintingLabels: normalizeStringArray(raw.specialPrintingLabels),
    scryfallMetadata: normalizeScryfallMetadata(raw.scryfallMetadata),
  };
}

export function tradeStatusForScanner(value: unknown): Exclude<TradeBinderStatus, 'unknown'> {
  const status = normalizeTradeBinderStatus(value);
  return status === 'unknown' ? 'not_for_trade' : status;
}

export const unavailableCameraProvider: ScannerRecognitionProvider = {
  id: 'camera-unavailable',
  label: 'Camera capture unavailable',
  mode: 'unavailable',
  supportsImageCapture: false,
  retainsImagesByDefault: false,
  async recognize(input) {
    if (!input.online && input.cachedCandidates?.length) {
      return { ok: true, candidates: input.cachedCandidates, assisted: false, warning: 'Showing cached recent candidates while offline.' };
    }
    return { ok: false, reason: 'Camera recognition is unavailable in this build. Use manual search.', offline: !input.online };
  },
};

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function normalizeProviderIds(value: unknown): Record<string, string | number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 12).flatMap(([key, entry]) => {
    const provider = key.trim().toLowerCase();
    if (!provider || (typeof entry !== 'string' && typeof entry !== 'number')) return [];
    return [[provider, entry]];
  }));
}

function confirmedScryfallId(candidate: ScannerCardCandidate) {
  const gameId = normalizeScannerGameId(candidate.gameId ?? candidate.providerCategoryId);
  if (gameId !== 'magic') return null;
  const providerId = candidate.providerIds?.scryfall;
  if (typeof providerId === 'string' && providerId) return providerId;
  const sources = new Set(candidate.providerSources ?? []);
  if (candidate.providerSource === 'scryfall') sources.add('scryfall');
  return sources.has('scryfall') ? candidate.id : null;
}

function normalizeScannerGameId(value: unknown): ScannerGameId {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'pokemon' || raw === 'ptcg' || raw === '3') return 'pokemon';
  return 'magic';
}

function scannerGameLabel(value: unknown) {
  const gameId = normalizeScannerGameId(value);
  return gameId === 'pokemon' ? 'Pokemon' : 'Magic: The Gathering';
}

function normalizeScannerProductType(value: unknown): ScannerProductType {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'sealed' || raw === 'sealed_product' || raw === 'unopened') return 'sealed';
  return 'card';
}

function normalizeCandidateMarketPrice(value: ScannerCandidateMarketPrice | null | undefined): ScannerCandidateMarketPrice | null {
  if (!value || value.source !== 'scryfall') return null;
  return {
    usd: normalizePositivePrice(value.usd),
    usdFoil: normalizePositivePrice(value.usdFoil),
    usdEtched: normalizePositivePrice(value.usdEtched),
    source: 'scryfall',
    fetchedAt: stringValue(value.fetchedAt),
  };
}

function normalizePositivePrice(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map((entry) => stringValue(entry)).filter((entry): entry is string => Boolean(entry)))]
    : [];
}

function normalizeScryfallMetadata(value: ScannerCandidateScryfallMetadata | null | undefined): ScannerCandidateScryfallMetadata | null {
  if (!value) return null;
  return {
    releasedAt: stringValue(value.releasedAt),
    setType: stringValue(value.setType),
    promo: value.promo === true,
    promoTypes: normalizeStringArray(value.promoTypes),
    frameEffects: normalizeStringArray(value.frameEffects),
    layout: stringValue(value.layout),
  };
}
