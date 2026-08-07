import type { MagicCatalogSearch } from './magic-recognition-provider.ts';

export type BoundedTtlCacheOptions = {
  maxEntries: number;
  ttlMs: number;
  now?: () => number;
};

export type ScannerPrewarmTarget = 'ocr_provider' | 'scryfall_lookup_cache' | 'camera_frame_processor' | 'recognition_service' | 'pricing_service';

export type ScannerPrewarmResult = {
  target: ScannerPrewarmTarget;
  status: 'warmed' | 'failed';
  latencyMs: number;
  reason: string | null;
};

export class BoundedTtlCache<TKey, TValue> {
  private readonly entries = new Map<TKey, { value: TValue; expiresAt: number; touchedAt: number }>();
  private readonly now: () => number;
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(options: BoundedTtlCacheOptions) {
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries));
    this.ttlMs = Math.max(1, Math.floor(options.ttlMs));
    this.now = options.now ?? (() => Date.now());
  }

  get(key: TKey): TValue | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }
    entry.touchedAt = this.now();
    return entry.value;
  }

  set(key: TKey, value: TValue) {
    const now = this.now();
    this.entries.set(key, { value, expiresAt: now + this.ttlMs, touchedAt: now });
    this.evictIfNeeded();
  }

  has(key: TKey) {
    return this.get(key) !== null;
  }

  clear() {
    this.entries.clear();
  }

  size() {
    return this.entries.size;
  }

  private evictIfNeeded() {
    while (this.entries.size > this.maxEntries) {
      const oldest = [...this.entries.entries()].sort((a, b) => a[1].touchedAt - b[1].touchedAt)[0];
      if (!oldest) return;
      this.entries.delete(oldest[0]);
    }
  }
}

export function createCachedMagicCatalogSearch(input: {
  search: MagicCatalogSearch;
  cache?: BoundedTtlCache<string, Awaited<ReturnType<MagicCatalogSearch>>>;
  maxEntries?: number;
  ttlMs?: number;
  now?: () => number;
}): MagicCatalogSearch {
  const cache = input.cache ?? new BoundedTtlCache<string, Awaited<ReturnType<MagicCatalogSearch>>>({
    maxEntries: input.maxEntries ?? 64,
    ttlMs: input.ttlMs ?? 5 * 60 * 1000,
    now: input.now,
  });
  return async (query) => {
    const key = magicCatalogCacheKey(query);
    const cached = cache.get(key);
    if (cached) return cached.map((candidate) => ({ ...candidate }));
    const result = await input.search(query);
    cache.set(key, result.map((candidate) => ({ ...candidate })));
    return result;
  };
}

export async function prewarmScannerServices(input: {
  targets: { target: ScannerPrewarmTarget; warm: () => Promise<void> | void }[];
  now?: () => number;
}): Promise<ScannerPrewarmResult[]> {
  const now = input.now ?? (() => Date.now());
  return Promise.all(input.targets.map(async (target) => {
    const startedAt = now();
    try {
      await target.warm();
      return { target: target.target, status: 'warmed', latencyMs: Math.max(0, now() - startedAt), reason: null };
    } catch (error) {
      return {
        target: target.target,
        status: 'failed',
        latencyMs: Math.max(0, now() - startedAt),
        reason: error instanceof Error ? error.message : 'Unknown prewarm failure.',
      };
    }
  }));
}

function magicCatalogCacheKey(query: Parameters<MagicCatalogSearch>[0]) {
  return [
    normalizeKeyPart(query.name),
    normalizeKeyPart(query.setCode),
    normalizeKeyPart(query.collectorNumber),
  ].join('|');
}

function normalizeKeyPart(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}
