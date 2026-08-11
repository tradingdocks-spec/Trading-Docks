import type {
  TcgTrackingClient,
} from "./client.ts";
import type {
  TcgTrackingScanCandidate,
  TcgTrackingScanResult,
} from "./types.ts";

export type TradingDocksScannerCandidate = {
  source: "tcgtracking";
  tcgplayerProductId?: number;
  providerProductId?: string;
  name?: string;
  setName?: string;
  setCode?: string;
  collectorNumber?: string;
  imageUrl?: string;
  confidence: number;
  requiresConfirmation: true;
};

export type TcgTrackingScannerAdapterResult = {
  status: "candidates" | "unresolved" | "provider_failed";
  candidates: TradingDocksScannerCandidate[];
  latencyMs?: number;
  error?: string;
};

export async function scanCardImageWithTcgTracking(input: {
  client: Pick<TcgTrackingClient, "scanCardImage">;
  image: Blob | ArrayBuffer | Uint8Array | string;
  category?: string;
}): Promise<TcgTrackingScannerAdapterResult> {
  const result = await input.client.scanCardImage({
    image: input.image,
    category: input.category,
  });
  return scannerAdapterResult(result);
}

export function scannerAdapterResult(
  result: TcgTrackingScanResult,
): TcgTrackingScannerAdapterResult {
  if (result.status === "provider_failed") {
    return {
      status: "provider_failed",
      candidates: [],
      latencyMs: result.latencyMs,
      error: result.error,
    };
  }

  const candidates = result.candidates
    .map(toTradingDocksScannerCandidate)
    .filter(
      (candidate): candidate is TradingDocksScannerCandidate =>
        Boolean(candidate),
    );

  return {
    status: candidates.length ? "candidates" : "unresolved",
    candidates,
    latencyMs: result.latencyMs,
  };
}

function toTradingDocksScannerCandidate(
  candidate: TcgTrackingScanCandidate,
): TradingDocksScannerCandidate | null {
  if (!candidate.tcgplayerProductId && !candidate.providerProductId) {
    return null;
  }

  return {
    source: "tcgtracking",
    tcgplayerProductId: candidate.tcgplayerProductId,
    providerProductId: candidate.providerProductId,
    name: candidate.name,
    setName: candidate.setName,
    setCode: candidate.setCode,
    collectorNumber: candidate.collectorNumber,
    imageUrl: candidate.imageUrl,
    confidence: candidate.confidence,
    requiresConfirmation: true,
  };
}
