import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat, type Action } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';
import { MOBILE_CANONICAL_SITE_URL } from '@/services/mobile-release-config';
import type { PixelRect } from '@/services/magic-ocr-pipeline';
import type { ScannerCardCandidate } from '@/services/scanner-foundation';
import {
  TCGTRACKING_MAGIC_GAME_ID,
  TCGTRACKING_SCAN_DEFAULT_LIMIT,
  TCGTRACKING_SCAN_MAX_IMAGE_BYTES,
  TCGTRACKING_SCAN_TIMEOUT_MS,
  classifyTcgTrackingScanConfidence,
  decodedImageBytes,
  tcgTrackingCandidateToScannerCandidate,
  type TcgTrackingMobileScanCandidate,
  type TcgTrackingScanConfidenceBand,
} from '@/services/tcgtracking-scan-contract';
export {
  TCGTRACKING_MAGIC_GAME_ID,
  TCGTRACKING_SCAN_DEFAULT_LIMIT,
  TCGTRACKING_SCAN_MAX_IMAGE_BYTES,
  TCGTRACKING_SCAN_TIMEOUT_MS,
  classifyTcgTrackingScanConfidence,
  decodedImageBytes,
  tcgTrackingCandidateToScannerCandidate,
};

export type TcgTrackingPreparedScanImage = {
  image: string;
  width: number;
  height: number;
  bytes: number;
  mimeType: 'image/jpeg';
};

export type TcgTrackingMobileScanResult =
  | {
    ok: true;
    provider: 'tcgtracking';
    status: 'candidates';
    candidates: ScannerCardCandidate[];
    latencyMs: number | null;
    topConfidence: number | null;
    confidenceBand: TcgTrackingScanConfidenceBand;
    fallbackRecommended: boolean;
    image: { width: number; height: number; bytes: number; retained: false };
  }
  | {
    ok: false;
    provider: 'tcgtracking';
    reason: string;
    fallbackRecommended: true;
    latencyMs?: number | null;
  };

export async function prepareTcgTrackingScanImage(input: {
  imageUri: string;
  cropPixels?: PixelRect | null;
  targetLongEdge?: number;
}): Promise<TcgTrackingPreparedScanImage> {
  const targetLongEdges = [
    input.targetLongEdge ?? 720,
    640,
    560,
    480,
    400,
    340,
  ];
  const qualities = [0.76, 0.66, 0.56, 0.46, 0.36, 0.28];
  let lastResult: TcgTrackingPreparedScanImage | null = null;

  for (const targetLongEdge of targetLongEdges) {
    for (const quality of qualities) {
      const actions = scanImageActions(input.cropPixels, targetLongEdge);
      const manipulated = await manipulateAsync(input.imageUri, actions, {
        compress: quality,
        format: SaveFormat.JPEG,
        base64: true,
      });
      const image = manipulated.base64 ?? '';
      const bytes = decodedImageBytes(image);
      lastResult = {
        image,
        width: manipulated.width,
        height: manipulated.height,
        bytes,
        mimeType: 'image/jpeg',
      };
      await deleteTemporaryImage(manipulated.uri, input.imageUri);
      if (bytes > 0 && bytes <= TCGTRACKING_SCAN_MAX_IMAGE_BYTES) {
        return lastResult;
      }
    }
  }

  if (lastResult) {
    throw new Error(`Compressed scan image is still ${lastResult.bytes} bytes. TCGTracking requires ${TCGTRACKING_SCAN_MAX_IMAGE_BYTES} bytes or less.`);
  }
  throw new Error('Could not prepare a compressed scan image.');
}

export async function scanPreparedImageWithTcgTracking(input: {
  preparedImage: TcgTrackingPreparedScanImage;
  gameId?: number;
  setIds?: number[];
  limit?: 5 | 10;
  fetcher?: typeof fetch;
}): Promise<TcgTrackingMobileScanResult> {
  if (!supabase) {
    return failure('Scanner authentication is not configured.');
  }
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    return failure('Sign in again to use enhanced recognition.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TCGTRACKING_SCAN_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const response = await (input.fetcher ?? fetch)(`${MOBILE_CANONICAL_SITE_URL}/api/scanner/tcgtracking`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: input.preparedImage.image,
        gameId: input.gameId ?? TCGTRACKING_MAGIC_GAME_ID,
        setIds: input.setIds ?? [],
        limit: input.limit ?? TCGTRACKING_SCAN_DEFAULT_LIMIT,
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as {
      status?: string;
      candidates?: TcgTrackingMobileScanCandidate[];
      latencyMs?: number;
      topConfidence?: number | null;
      confidenceBand?: TcgTrackingScanConfidenceBand;
      fallbackRecommended?: boolean;
      error?: string;
    };
    if (!response.ok || payload.status === 'provider_failed') {
      return failure(payload.error ?? 'Enhanced recognition is unavailable.', payload.latencyMs ?? Date.now() - startedAt);
    }
    const candidates = (payload.candidates ?? [])
      .map(tcgTrackingCandidateToScannerCandidate)
      .filter((candidate): candidate is ScannerCardCandidate => Boolean(candidate));
    if (!candidates.length) {
      return failure('Enhanced recognition did not resolve a supported printing.', payload.latencyMs ?? Date.now() - startedAt);
    }
    return {
      ok: true,
      provider: 'tcgtracking',
      status: 'candidates',
      candidates,
      latencyMs: payload.latencyMs ?? Date.now() - startedAt,
      topConfidence: payload.topConfidence ?? candidates[0]?.confidence ?? null,
      confidenceBand: payload.confidenceBand ?? classifyTcgTrackingScanConfidence(candidates[0]?.confidence ?? 0),
      fallbackRecommended: payload.fallbackRecommended === true || classifyTcgTrackingScanConfidence(candidates[0]?.confidence ?? 0) === 'low',
      image: {
        width: input.preparedImage.width,
        height: input.preparedImage.height,
        bytes: input.preparedImage.bytes,
        retained: false,
      },
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : 'Enhanced recognition is unavailable.', Date.now() - startedAt);
  } finally {
    clearTimeout(timeout);
  }
}

function scanImageActions(cropPixels: PixelRect | null | undefined, targetLongEdge: number): Action[] {
  const actions: Action[] = [];
  if (cropPixels && cropPixels.width > 0 && cropPixels.height > 0) {
    actions.push({
      crop: {
        originX: Math.max(0, Math.round(cropPixels.x)),
        originY: Math.max(0, Math.round(cropPixels.y)),
        width: Math.max(1, Math.round(cropPixels.width)),
        height: Math.max(1, Math.round(cropPixels.height)),
      },
    });
  }
  actions.push({
    resize: cropPixels && cropPixels.height > cropPixels.width
      ? { height: targetLongEdge }
      : { width: targetLongEdge },
  });
  return actions;
}

async function deleteTemporaryImage(uri: string | undefined, sourceUri: string) {
  if (!uri || uri === sourceUri || !uri.startsWith('file://')) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Temporary provider images are best-effort cleanup only.
  }
}

function failure(reason: string, latencyMs: number | null = null): TcgTrackingMobileScanResult {
  return {
    ok: false,
    provider: 'tcgtracking',
    reason,
    fallbackRecommended: true,
    latencyMs,
  };
}
