import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  TCGTRACKING_SCAN_TIMEOUT_MS,
  createTcgTrackingClient,
  normalizeTcgTrackingScanProviderRequest,
  scanCardImageWithTcgTracking,
} from "@/lib/providers/tcgtracking";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthenticatedScanActor = {
  userId: string;
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

  console.info("TCGTracking mobile scan completed", {
    provider: "tcgtracking",
    status: result.status,
    latencyMs: result.latencyMs,
    candidateCount: result.candidates.length,
    topScore: result.topConfidence ?? null,
    fallbackRecommended: result.fallbackRecommended,
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
    if (!error && data.user) return { userId: data.user.id };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { userId: user.id } : null;
}

function imageByteLength(image: string) {
  const base64 = image.includes(",") ? image.split(",").pop() ?? "" : image;
  const clean = base64.replace(/\s+/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}
