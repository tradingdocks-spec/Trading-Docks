import { NextResponse } from "next/server";

import { parseRecognitionRequest, recognizeCard } from "@/lib/card-intelligence";
import { MemoryRecognitionRateLimiter } from "@/lib/card-intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 24_000;
const rateLimiter = new MemoryRecognitionRateLimiter();

export async function POST(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Recognition signals are too large." }, { status: 413 });
  const payload = await request.json().catch(() => null);
  const parsed = parseRecognitionRequest(payload);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = await recognizeCard(parsed.signals, { limit: parsed.limit, signal: request.signal });
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function rateLimit(request: Request) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const result = await rateLimiter.consume(key, 30, 60_000);
  if (result.allowed) return null;
  return NextResponse.json({ error: "Recognition rate limit exceeded." }, { status: 429, headers: { "Retry-After": `${result.retryAfterSeconds}` } });
}
