import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  TCGTRACKING_SCAN_TIMEOUT_MS,
  createTcgTrackingClient,
  normalizeTcgTrackingScanProviderRequest,
  scanCardImageWithTcgTracking,
  type TradingDocksScannerCandidate,
} from "@/lib/providers/tcgtracking";
import { apiCapabilityDecision } from "@/lib/platform/api-access";
import { resolvePlatformAccessForUser } from "@/lib/platform/server-access";
import { createClient } from "@/lib/supabase/server";
import { recognizeCard, sanitizedIntelligenceResponse, type CanonicalPrinting } from "@/lib/card-intelligence";
import { getGameByTcgTrackingGameId } from "@/lib/multi-tcg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthenticatedScanActor = {
  userId: string;
  access: Awaited<ReturnType<typeof resolvePlatformAccessForUser>>;
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  const actor = await authenticateScanActor(request);
  if (!actor) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }
  const capability = apiCapabilityDecision(actor.access, "scanner.use");
  if (!capability.allowed) {
    return NextResponse.json(
      { error: capability.error },
      { status: capability.status },
    );
  }

  const payload = await request.json().catch(() => null);
  const normalized = normalizeTcgTrackingScanProviderRequest(payload);
  if (!normalized.ok) {
    return NextResponse.json(
      { error: normalized.error },
      { status: normalized.status },
    );
  }

  console.info("TCGTracking mobile scan started", {
    provider: "tcgtracking",
    gameId: normalized.request.gameId,
    setIdCount: normalized.request.setIds?.length ?? 0,
    limit: normalized.request.limit,
    imageBytes: imageByteLength(normalized.request.image),
    userIdPresent: Boolean(actor.userId),
  });

  const client = createTcgTrackingClient({
    timeoutMs: TCGTRACKING_SCAN_TIMEOUT_MS,
    retries: 0,
  });
  const result = await scanCardImageWithTcgTracking({
    client,
    image: normalized.request.image,
    gameId: normalized.request.gameId,
    setIds: normalized.request.setIds,
    limit: normalized.request.limit,
  });
  const intelligence = result.candidates.length
    ? await recognizeCard({
        game: scannerGame(normalized.request.gameId),
        cardName: result.candidates[0]?.name,
        setCode: result.candidates[0]?.setCode,
        collectorNumber: result.candidates[0]?.collectorNumber,
        providerIds: {
          tcgplayer: result.candidates[0]?.tcgplayerProductId,
          tcgtracking: result.candidates[0]?.providerProductId,
        },
      }, {
        seedCandidates: result.candidates.map(tcgTrackingIntelligenceCandidate).filter((candidate): candidate is CanonicalPrinting => Boolean(candidate)),
        limit: normalized.request.limit,
      })
    : null;

  console.info("TCGTracking mobile scan completed", {
    provider: "tcgtracking",
    status: result.status,
    latencyMs: result.latencyMs,
    candidateCount: result.candidates.length,
    topScore: result.topConfidence ?? null,
    fallbackRecommended: result.fallbackRecommended,
    intelligence: sanitizedIntelligenceResponse(intelligence),
    totalLatencyMs: Date.now() - startedAt,
  });

  const status = result.status === "provider_failed" ? 502 : 200;
  return NextResponse.json({
    provider: "tcgtracking",
    status: result.status,
    candidates: result.candidates.slice(0, normalized.request.limit),
    latencyMs: result.latencyMs,
    topConfidence: result.topConfidence ?? null,
    confidenceBand: result.confidenceBand ?? "low",
    fallbackRecommended: result.fallbackRecommended,
    error: result.status === "provider_failed" ? result.error : undefined,
    image: {
      bytes: imageByteLength(normalized.request.image),
      retained: false,
    },
  }, { status });
}

function scannerGame(gameId: number): "magic" | "pokemon" | "unknown" {
  const game = getGameByTcgTrackingGameId(gameId)?.id;
  return game === "magic" || game === "pokemon" ? game : "unknown";
}

function tcgTrackingIntelligenceCandidate(candidate: TradingDocksScannerCandidate): CanonicalPrinting | null {
  const identity = candidate.productIdentity;
  const printingId = identity?.scryfallId
    ?? (candidate.tcgplayerProductId ? `tcgplayer:${candidate.tcgplayerProductId}` : candidate.providerProductId ? `tcgtracking:${candidate.providerProductId}` : null);
  const game = getGameByTcgTrackingGameId(Number(identity?.gameCategoryId))?.id;
  if (!printingId || !candidate.name || (game !== "magic" && game !== "pokemon")) return null;
  return {
    canonicalCardId: identity?.scryfallId ?? `${game}:${candidate.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    printingId,
    game,
    name: candidate.name,
    setName: candidate.setName ?? null,
    setCode: candidate.setCode ?? null,
    collectorNumber: candidate.collectorNumber ?? null,
    language: null,
    finishes: [],
    rarity: null,
    imageUrl: candidate.imageUrl ?? null,
    providerIds: Object.fromEntries(Object.entries({ scryfall: identity?.scryfallId, tcgplayer: candidate.tcgplayerProductId, tcgtracking: candidate.providerProductId }).filter((entry): entry is [string, string | number] => entry[1] !== undefined)),
    provenance: ["tcgtracking", ...(identity?.scryfallId ? ["scryfall"] : []), ...(candidate.tcgplayerProductId ? ["tcgplayer"] : [])],
    identityAuthority: "provider_confirmed",
    prices: [],
  };
}

async function authenticateScanActor(
  request: Request,
): Promise<AuthenticatedScanActor | null> {
  const authorization = request.headers.get("authorization");
  if (authorization?.trim()) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;
    const supabase = createSupabaseClient(url, key, {
      global: { headers: { authorization } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      const access = await resolvePlatformAccessForUser(supabase, data.user);
      return { userId: data.user.id, access };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const access = await resolvePlatformAccessForUser(supabase, user);
  return { userId: user.id, access };
}

function imageByteLength(image: string) {
  const base64 = image.includes(",") ? image.split(",").pop() ?? "" : image;
  const clean = base64.replace(/\s+/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}
