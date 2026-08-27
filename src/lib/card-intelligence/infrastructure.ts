import type { CanonicalPrinting, CardIntelligenceCache, RecognitionRateLimiter } from "./types.ts";

export class MemoryCardIntelligenceCache implements CardIntelligenceCache {
  private entries = new Map<string, { expiresAt: number; value: CanonicalPrinting[] }>();
  private readonly maxEntries: number;
  constructor(maxEntries = 500) { this.maxEntries = maxEntries; }
  async get(key: string) { const entry = this.entries.get(key); if (!entry || entry.expiresAt <= Date.now()) { this.entries.delete(key); return null; } return entry.value; }
  async set(key: string, value: CanonicalPrinting[], ttlMs: number) { this.entries.set(key, { expiresAt: Date.now() + ttlMs, value }); if (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!); }
}

export class MemoryRecognitionRateLimiter implements RecognitionRateLimiter {
  private buckets = new Map<string, { count: number; resetsAt: number }>();
  async consume(key: string, limit: number, windowMs: number) { const now = Date.now(); let bucket = this.buckets.get(key); if (!bucket || bucket.resetsAt <= now) { bucket = { count: 0, resetsAt: now + windowMs }; this.buckets.set(key, bucket); } bucket.count += 1; return { allowed: bucket.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetsAt - now) / 1000)) }; }
}
