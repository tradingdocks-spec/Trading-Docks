import { normalizeScannerCandidate, type ScannerCardCandidate } from './scanner-foundation.ts';

export const TCGTRACKING_MAGIC_GAME_ID = 1;
export const TCGTRACKING_POKEMON_GAME_ID = 3;
export const TCGTRACKING_SCAN_MAX_IMAGE_BYTES = 100_000;
export const TCGTRACKING_SCAN_DEFAULT_LIMIT = 5;
export const TCGTRACKING_SCAN_TIMEOUT_MS = 5200;

export type TcgTrackingScanConfidenceBand = 'high' | 'medium' | 'low';
export type TcgTrackingScanGame = 'magic' | 'pokemon';

export const TCGTRACKING_SCAN_GAMES: Array<{
  id: TcgTrackingScanGame;
  label: string;
  gameId: number;
}> = [
  { id: 'magic', label: 'Magic', gameId: TCGTRACKING_MAGIC_GAME_ID },
  { id: 'pokemon', label: 'Pokemon', gameId: TCGTRACKING_POKEMON_GAME_ID },
];

export function tcgTrackingScanGameId(game: TcgTrackingScanGame) {
  return TCGTRACKING_SCAN_GAMES.find((entry) => entry.id === game)?.gameId ?? TCGTRACKING_MAGIC_GAME_ID;
}

export function tcgTrackingScanGameLabel(game: TcgTrackingScanGame) {
  return TCGTRACKING_SCAN_GAMES.find((entry) => entry.id === game)?.label ?? 'Magic';
}

export type TcgTrackingMobileScanCandidate = {
  source: 'tcgtracking';
  gameId?: number | string;
  providerCategoryId?: string;
  tcgplayerProductId?: number;
  tcgplayerSkuId?: number;
  providerProductId?: string;
  providerSkuId?: string;
  productType?: 'card' | 'sealed';
  variant?: string;
  productIdentity?: {
    scryfallId?: string;
    name?: string;
    setName?: string;
    setCode?: string;
    collectorNumber?: string;
    imageUrl?: string;
    tcgplayerProductId?: number;
    tcgplayerSkuId?: number;
    providerProductId?: string;
    providerSkuId?: string;
    providerCategoryId?: string;
    productType?: 'card' | 'sealed';
    variant?: string;
  } | null;
  name?: string;
  setName?: string;
  setCode?: string;
  collectorNumber?: string;
  imageUrl?: string;
  confidence: number;
  requiresConfirmation: true;
};

export function tcgTrackingCandidateToScannerCandidate(
  candidate: TcgTrackingMobileScanCandidate,
  options: { game?: TcgTrackingScanGame; gameId?: number | string } = {},
): ScannerCardCandidate | null {
  const identity = candidate.productIdentity ?? null;
  const scryfallId = identity?.scryfallId?.trim();
  const providerProductId = identity?.providerProductId ?? candidate.providerProductId;
  const providerSkuId = identity?.providerSkuId ?? candidate.providerSkuId;
  const providerCategoryId = identity?.providerCategoryId ?? candidate.providerCategoryId ?? categoryIdFromGame(options.gameId ?? candidate.gameId ?? options.game);
  const tcgplayerProductId = identity?.tcgplayerProductId ?? candidate.tcgplayerProductId;
  const tcgplayerSkuId = identity?.tcgplayerSkuId ?? candidate.tcgplayerSkuId;
  const id = scryfallId || (tcgplayerProductId ? `tcgtracking:${tcgplayerProductId}` : providerProductId ? `tcgtracking:${providerProductId}` : null);
  if (!id) return null;
  const gameId = normalizeMobileGameId(options.gameId ?? candidate.gameId ?? options.game ?? providerCategoryId);
  const variant = identity?.variant ?? candidate.variant ?? null;
  return normalizeScannerCandidate({
    id,
    gameId,
    gameLabel: gameId === 'pokemon' ? 'Pokemon' : 'Magic: The Gathering',
    productType: identity?.productType ?? candidate.productType ?? 'card',
    providerCategoryId,
    tcgplayerProductId,
    tcgplayerSkuId,
    providerProductId,
    providerSkuId,
    providerSource: 'tcgtracking',
    name: identity?.name ?? candidate.name,
    setCode: identity?.setCode ?? candidate.setCode,
    setName: identity?.setName ?? candidate.setName,
    collectorNumber: identity?.collectorNumber ?? candidate.collectorNumber,
    imageUrl: identity?.imageUrl ?? candidate.imageUrl,
    confidence: candidate.confidence,
    recognitionMode: 'assisted_capture',
    finishes: gameId === 'pokemon' ? ['normal'] : ['normal', 'foil', 'etched'],
    variant,
    language: 'en',
  });
}

export function classifyTcgTrackingScanConfidence(confidence: number): TcgTrackingScanConfidenceBand {
  const normalized = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence > 1 ? confidence / 100 : confidence)) : 0;
  if (normalized >= 0.92) return 'high';
  if (normalized >= 0.78) return 'medium';
  return 'low';
}

export function decodedImageBytes(image: string) {
  const clean = (image.includes(',') ? image.split(',').pop() ?? '' : image).replace(/\s+/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

function normalizeMobileGameId(value: unknown): TcgTrackingScanGame {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'pokemon' || raw === String(TCGTRACKING_POKEMON_GAME_ID)) return 'pokemon';
  return 'magic';
}

function categoryIdFromGame(value: unknown) {
  const game = normalizeMobileGameId(value);
  return String(tcgTrackingScanGameId(game));
}
