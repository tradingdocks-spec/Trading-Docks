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
  tcgplayerProductId?: number;
  providerProductId?: string;
  productIdentity?: {
    scryfallId?: string;
    name?: string;
    setName?: string;
    setCode?: string;
    collectorNumber?: string;
    imageUrl?: string;
    tcgplayerProductId?: number;
    providerProductId?: string;
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
): ScannerCardCandidate | null {
  const identity = candidate.productIdentity ?? null;
  const scryfallId = identity?.scryfallId?.trim();
  const providerProductId = identity?.providerProductId ?? candidate.providerProductId;
  const tcgplayerProductId = identity?.tcgplayerProductId ?? candidate.tcgplayerProductId;
  const id = scryfallId || (tcgplayerProductId ? `tcgtracking:${tcgplayerProductId}` : providerProductId ? `tcgtracking:${providerProductId}` : null);
  if (!id) return null;
  return normalizeScannerCandidate({
    id,
    tcgplayerProductId,
    providerProductId,
    providerSource: 'tcgtracking',
    name: identity?.name ?? candidate.name,
    setCode: identity?.setCode ?? candidate.setCode,
    setName: identity?.setName ?? candidate.setName,
    collectorNumber: identity?.collectorNumber ?? candidate.collectorNumber,
    imageUrl: identity?.imageUrl ?? candidate.imageUrl,
    confidence: candidate.confidence,
    recognitionMode: 'assisted_capture',
    finishes: ['normal', 'foil', 'etched'],
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
