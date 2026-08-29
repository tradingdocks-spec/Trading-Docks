import { NextResponse } from "next/server";

import {
  cardSightUsageSnapshot,
  CardSightProvider,
  type CardSightImageMode,
  logCardSightConfig,
  sanitizedIntelligenceResponse,
} from "@/lib/card-intelligence";
import {
  authenticateScannerRequest,
  logScannerAuthTrace,
  scannerAuthFailureResponse,
} from "./auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_000_000;

export async function POST(request: Request) {
  const startedAt = Date.now();
  logCardSightConfig("/api/scanner/cardsight");
  const auth = await authenticateScannerRequest(request);
  logScannerAuthTrace(auth.trace);
  if (!auth.actor) {
    return NextResponse.json(scannerAuthFailureResponse(auth.trace, auth.capability.error ?? "Authentication required.", auth.capability.status), { status: auth.capability.status });
  }
  if (!auth.capability.allowed) {
    return NextResponse.json(scannerAuthFailureResponse(auth.trace, auth.capability.error ?? "Authentication required.", auth.capability.status), { status: auth.capability.status });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Recognition image is too large." }, { status: 413 });
  }

  const payload = await request.json().catch(() => null);
  const normalized = normalizeRequest(payload);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: normalized.status });
  }

  const provider = new CardSightProvider();
  const result = await provider.recognizeImage({
    image: normalized.request.image,
    game: normalized.request.game,
    limit: normalized.request.limit,
    mode: normalized.request.mode,
    signal: request.signal,
  });

  const status = result.ok ? 200 : result.status === "unavailable" ? 503 : result.status === "timeout" ? 504 : 502;
  return NextResponse.json({
    provider: "cardsight",
    status: result.ok ? "candidates" : result.status,
    mode: normalized.request.mode,
    candidates: result.ok ? result.candidates : [],
    topCandidate: result.ok ? result.topCandidate : null,
    intelligence: result.ok ? sanitizedIntelligenceResponse(result.intelligence) : null,
    latencyMs: result.ok ? result.topCandidate?.latencyMs ?? null : result.latencyMs,
    metrics: cardSightUsageSnapshot(),
    fallbackRecommended: result.ok
      ? Boolean(result.intelligence.requiresConfirmation || !result.intelligence.selectedPrintingId)
      : true,
    image: {
      bytes: imageByteLength(normalized.request.image),
      retained: false,
    },
    error: result.ok ? undefined : result.reason,
    auth: process.env.NODE_ENV === "production" ? undefined : auth.trace,
    totalLatencyMs: Date.now() - startedAt,
  }, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

type NormalizedRequest =
  | { ok: true; request: { image: string; game: "magic" | "pokemon" | "unknown"; limit: number; mode: CardSightImageMode } }
  | { ok: false; status: number; error: string };

function normalizeRequest(value: unknown): NormalizedRequest {
  if (!value || typeof value !== "object") {
    return { ok: false, status: 400, error: "Provide a scan image." };
  }
  const source = value as Record<string, unknown>;
  const image = typeof source.image === "string" ? source.image.trim() : "";
  if (!image) {
    return { ok: false, status: 400, error: "Provide a base64 card image." };
  }
  const bytes = imageByteLength(image);
  if (bytes <= 0) {
    return { ok: false, status: 400, error: "Provide a valid base64 JPEG image." };
  }
  const game = normalizeGame(source.game);
  const limit = Math.max(1, Math.min(normalizeInteger(source.limit) ?? 5, 10));
  const mode = source.mode === "cropped" ? "cropped" : "raw";
  return { ok: true, request: { image, game, limit, mode } };
}

function normalizeGame(value: unknown): "magic" | "pokemon" | "unknown" {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized === "magic" || normalized === "pokemon" ? normalized : "unknown";
}

function normalizeInteger(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function imageByteLength(image: string) {
  const base64 = image.includes(",") ? image.split(",").pop() ?? "" : image;
  const clean = base64.replace(/\s+/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}
