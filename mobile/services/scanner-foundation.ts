import {
  MEMBERSHIP_PLANS,
  normalizeMembershipTier,
} from './membership-catalog.ts';
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
  oracleId?: string | null;
  name: string;
  setCode: string | null;
  setName: string | null;
  collectorNumber: string | null;
  finishes: CardFinish[];
  language: string | null;
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
  return {
    id,
    user_id: confirmation.userId,
    card_name: confirmation.candidate.name,
    scryfall_id: confirmation.candidate.id,
    set_code: confirmation.candidate.setCode,
    collector_number: confirmation.candidate.collectorNumber,
    quantity: confirmation.quantity,
    location_id: confirmation.storageLocationId,
    data: {
      name: confirmation.candidate.name,
      scryfallId: confirmation.candidate.id,
      set: confirmation.candidate.setCode,
      setName: confirmation.candidate.setName,
      collectorNumber: confirmation.candidate.collectorNumber,
      finish: confirmation.finish,
      condition: confirmation.condition,
      language: confirmation.language,
      imageUrl: confirmation.candidate.imageUrl ?? null,
      locationId: confirmation.storageLocationId,
      scannerAddedAt: new Date().toISOString(),
      scannerRecognitionMode: confirmation.candidate.recognitionMode,
    },
  };
}

export function scannerQueueKey(confirmation: ScannerConfirmation) {
  return `${confirmation.userId}:${confirmation.candidate.id}:${confirmation.finish}:${confirmation.condition}:${confirmation.storageLocationId ?? 'unassigned'}`;
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
  oracleId?: unknown;
  name?: unknown;
  setCode?: unknown;
  setName?: unknown;
  collectorNumber?: unknown;
  finishes?: unknown;
  language?: unknown;
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
    oracleId: stringValue(raw.oracleId),
    name,
    setCode: stringValue(raw.setCode)?.toUpperCase() ?? null,
    setName: stringValue(raw.setName) ?? null,
    collectorNumber: stringValue(raw.collectorNumber) ?? null,
    finishes: finishes.length ? [...new Set(finishes)] : ['normal'],
    language: stringValue(raw.language) ?? 'en',
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
